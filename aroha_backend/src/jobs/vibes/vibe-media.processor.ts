import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import type { Job } from "bullmq";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppLogger } from "../../common/logger/app-logger.service";
import vibesConfig from "../../config/vibes.config";
import { PrismaService } from "../../database/prisma/prisma.service";
import { ObjectStorageService } from "../../integrations/object-storage/object-storage.service";
import { VibeModerationService } from "../../modules/vibes/application/vibe-moderation.service";

export interface VibeMediaJobPayload {
  vibeId: string;
}

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
};

export type ProbeResult = {
  format?: { duration?: string; format_name?: string };
  streams?: ProbeStream[];
};

export class VibeMediaRejectedError extends Error {}
export class MediaToolTimeoutError extends Error {}

@Injectable()
export class VibeMediaProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly logger: AppLogger,
    private readonly moderationService: VibeModerationService,
    @Inject(vibesConfig.KEY)
    private readonly config: ConfigType<typeof vibesConfig>,
  ) {}

  async process(job: Job<VibeMediaJobPayload>): Promise<void> {
    const vibe = await this.prisma.vibeMedia.findUnique({ where: { id: job.data.vibeId } });
    if (!vibe || vibe.status !== "PROCESSING" || vibe.deletedAt) return;

    const workspace = await mkdtemp(join(tmpdir(), "yariva-vibe-"));
    const videoInput = join(workspace, "source-video");
    const musicInput = join(workspace, "source-music");
    const videoOutput = join(workspace, "vibe.mp4");
    const thumbnailOutput = join(workspace, "thumbnail.jpg");

    try {
      await this.storage.downloadObjectToFile({
        bucket: vibe.sourceBucket,
        objectKey: vibe.sourceObjectKey,
        destinationPath: videoInput,
      });
      const sourceProbe = await probeMedia(this.config.ffprobePath, videoInput);
      const source = validateSourceProbe(sourceProbe, this.config.maxDurationSeconds);

      if (vibe.audioMode === "CUSTOM") {
        if (!vibe.musicBucket || !vibe.musicObjectKey) {
          throw new VibeMediaRejectedError("Custom audio is missing");
        }
        await this.storage.downloadObjectToFile({
          bucket: vibe.musicBucket,
          objectKey: vibe.musicObjectKey,
          destinationPath: musicInput,
        });
        const musicProbe = await probeMedia(this.config.ffprobePath, musicInput);
        validateMusicProbe(musicProbe, source.durationSeconds);
      }

      await runMediaTool(
        this.config.ffmpegPath,
        buildFfmpegArgs({
          videoInput,
          musicInput,
          videoOutput,
          filter: vibe.filter,
          audioMode: vibe.audioMode,
          maxDurationSeconds: this.config.maxDurationSeconds,
        }),
        90_000,
      );
      await runMediaTool(
        this.config.ffmpegPath,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          "0.2",
          "-i",
          videoOutput,
          "-frames:v",
          "1",
          "-vf",
          "scale=360:-2",
          thumbnailOutput,
        ],
        30_000,
      );

      const outputProbe = await probeMedia(this.config.ffprobePath, videoOutput);
      const output = validateProcessedProbe(outputProbe, this.config.maxDurationSeconds);
      const processedObjectKey = `vibes/${vibe.userId}/${vibe.id}/ready.mp4`;
      const thumbnailObjectKey = `vibes/${vibe.userId}/${vibe.id}/thumbnail.jpg`;
      const processedSizeBytes = await this.storage.putFile({
        bucket: vibe.sourceBucket,
        objectKey: processedObjectKey,
        sourcePath: videoOutput,
        mimeType: "video/mp4",
      });
      await this.storage.putFile({
        bucket: vibe.sourceBucket,
        objectKey: thumbnailObjectKey,
        sourcePath: thumbnailOutput,
        mimeType: "image/jpeg",
      });

      const now = new Date();
      await this.prisma.vibeMedia.updateMany({
        where: { id: vibe.id, status: "PROCESSING", deletedAt: null },
        data: {
          processedBucket: vibe.sourceBucket,
          processedObjectKey,
          processedMimeType: "video/mp4",
          processedSizeBytes,
          thumbnailBucket: vibe.sourceBucket,
          thumbnailObjectKey,
          durationMs: Math.round(output.durationSeconds * 1000),
          width: output.video.width ?? source.video.width ?? null,
          height: output.video.height ?? source.video.height ?? null,
          videoCodec: output.video.codec_name ?? null,
          audioCodec: output.audio?.codec_name ?? null,
          moderationStatus: "PENDING",
          moderationProvider: null,
          moderationReason: null,
          moderatedAt: null,
          processingCompletedAt: now,
          failureReason: null,
          readyAt: null,
        },
      });

      if (this.config.moderationProvider === "local-development-stub") {
        await this.moderationService.review({
          vibeId: vibe.id,
          decision: "APPROVED",
          provider: "local-development-stub",
          reason: "Development-only deterministic moderation decision",
        });
      } else {
        this.logger.log(`Vibe ${vibe.id} is awaiting manual moderation`);
      }
    } catch (cause) {
      if (cause instanceof VibeMediaRejectedError) {
        await this.prisma.vibeMedia.updateMany({
          where: { id: vibe.id, status: "PROCESSING" },
          data: {
            status: "REJECTED",
            moderationStatus: "REJECTED",
            failureReason: cause.message.slice(0, 500),
          },
        });
        return;
      }

      const attempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
      if (job.attemptsMade + 1 >= attempts) {
        await this.prisma.vibeMedia.updateMany({
          where: { id: vibe.id, status: "PROCESSING" },
          data: {
            status: "FAILED",
            failureReason: "Vibe processing failed. Please try again.",
          },
        });
      }
      this.logger.error(
        `Vibe processing failed for ${vibe.id}`,
        cause instanceof Error ? cause.stack : undefined,
      );
      throw cause;
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
}

export function validateSourceProbe(probe: ProbeResult, maxDurationSeconds: number) {
  const durationSeconds = Number(probe.format?.duration);
  const formats = new Set((probe.format?.format_name ?? "").split(","));
  const videoStreams = probe.streams?.filter((stream) => stream.codec_type === "video") ?? [];
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new VibeMediaRejectedError("Video duration could not be verified");
  }
  // Containers can report a few encoder timebase ticks beyond the requested cap.
  if (durationSeconds > maxDurationSeconds + 0.05) {
    throw new VibeMediaRejectedError(`Vibe must be ${maxDurationSeconds} seconds or shorter`);
  }
  if (!["mov", "mp4", "3gp", "3g2", "mj2"].some((format) => formats.has(format))) {
    throw new VibeMediaRejectedError("Video container does not match an accepted upload format");
  }
  if (videoStreams.length !== 1) {
    throw new VibeMediaRejectedError("Vibe must contain exactly one video stream");
  }
  const video = videoStreams[0]!;
  if (!video.codec_name || !["h264", "hevc", "mpeg4", "vp8", "vp9"].includes(video.codec_name)) {
    throw new VibeMediaRejectedError("Video codec is not supported");
  }
  if ((video.width ?? 0) < 1 || (video.height ?? 0) < 1 || (video.width ?? 0) > 4096 || (video.height ?? 0) > 4096) {
    throw new VibeMediaRejectedError("Video dimensions are not supported");
  }
  return { durationSeconds, video };
}

export function validateMusicProbe(probe: ProbeResult, videoDurationSeconds: number) {
  const durationSeconds = Number(probe.format?.duration);
  const audioStreams = probe.streams?.filter((stream) => stream.codec_type === "audio") ?? [];
  const videoStreams = probe.streams?.filter((stream) => stream.codec_type === "video") ?? [];
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new VibeMediaRejectedError("Selected audio duration could not be verified");
  }
  if (audioStreams.length !== 1 || videoStreams.length > 0) {
    throw new VibeMediaRejectedError("Selected audio must contain one audio stream only");
  }
  if (durationSeconds > videoDurationSeconds + 0.05) {
    throw new VibeMediaRejectedError("Selected audio cannot be longer than the Vibe");
  }
  return { durationSeconds, audio: audioStreams[0]! };
}

export function validateProcessedProbe(probe: ProbeResult, maxDurationSeconds: number) {
  const durationSeconds = Number(probe.format?.duration);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  if (!video || video.codec_name !== "h264" || !Number.isFinite(durationSeconds) || durationSeconds > maxDurationSeconds + 0.05) {
    throw new Error("Processed Vibe failed output validation");
  }
  return { durationSeconds, video, audio };
}

export function buildFfmpegArgs(input: {
  videoInput: string;
  musicInput: string;
  videoOutput: string;
  filter: string;
  audioMode: string;
  maxDurationSeconds: number;
}): string[] {
  const videoFilter = filterExpression(input.filter);
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", input.videoInput];
  if (input.audioMode === "CUSTOM") {
    args.push("-stream_loop", "-1", "-i", input.musicInput);
  }
  args.push("-map", "0:v:0");
  if (input.audioMode === "ORIGINAL") {
    args.push("-map", "0:a?");
  } else if (input.audioMode === "CUSTOM") {
    args.push("-map", "1:a:0");
  }
  args.push(
    "-vf",
    videoFilter,
    "-t",
    String(input.maxDurationSeconds),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
  );
  if (input.audioMode === "MUTED") {
    args.push("-an");
  } else {
    args.push("-c:a", "aac", "-b:a", "128k");
  }
  if (input.audioMode === "CUSTOM") {
    args.push("-shortest");
  }
  args.push("-movflags", "+faststart", input.videoOutput);
  return args;
}

function filterExpression(filter: string): string {
  const base = "scale='min(720,iw)':-2:force_original_aspect_ratio=decrease";
  switch (filter) {
    case "WARM":
      return `${base},eq=saturation=1.08:contrast=1.03,colorbalance=rs=.06:bs=-.03`;
    case "COOL":
      return `${base},eq=saturation=.96:contrast=1.03,colorbalance=bs=.07:rs=-.025`;
    case "MONO":
      return `${base},hue=s=0,eq=contrast=1.06`;
    case "POP":
      return `${base},eq=saturation=1.22:contrast=1.06:brightness=.015`;
    default:
      return base;
  }
}

export async function probeMedia(
  executable: string,
  filePath: string,
  timeoutMs = 30_000,
): Promise<ProbeResult> {
  let output: string;
  try {
    output = await runMediaTool(
      executable,
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", filePath],
      timeoutMs,
    );
  } catch (cause) {
    if (cause instanceof MediaToolTimeoutError) throw cause;
    throw new VibeMediaRejectedError("Media could not be decoded");
  }
  try {
    return JSON.parse(output) as ProbeResult;
  } catch {
    throw new VibeMediaRejectedError("Media metadata could not be read");
  }
}

export async function runMediaTool(
  executable: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new MediaToolTimeoutError("Media tool timed out"));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 2_000_000) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 200_000) stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve(stdout);
      else reject(new Error(`Media tool exited with ${code}: ${stderr.slice(-2000)}`));
    });
  });
}
