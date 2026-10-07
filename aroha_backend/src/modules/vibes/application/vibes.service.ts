import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import { AppLogger } from "../../../common/logger/app-logger.service";
import { randomBase64Url, safeEqualHex } from "../../../common/utils/crypto.util";
import objectStorageConfig from "../../../config/object-storage.config";
import vibesConfig from "../../../config/vibes.config";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { BullmqProducer } from "../../../integrations/bullmq/bullmq.producer";
import { ObjectStorageService } from "../../../integrations/object-storage/object-storage.service";
import type {
  FinalizeVibeAssetDto,
  FinalizeVibeUploadDto,
  InitiateVibeUploadDto,
  VibeDto,
} from "../dto/vibes.dto";

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const MUSIC_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
]);

type VibeRecord = Awaited<ReturnType<PrismaService["vibeMedia"]["findFirst"]>>;

@Injectable()
export class VibesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
    private readonly queue: BullmqProducer,
    private readonly logger: AppLogger,
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    @Inject(vibesConfig.KEY)
    private readonly config: ConfigType<typeof vibesConfig>,
  ) {}

  async initiate(userId: string, input: InitiateVibeUploadDto) {
    if (!this.config.enabled) {
      throw new AppException(503, ERROR_CODES.FORBIDDEN, "Vibe recording is currently unavailable");
    }
    await this.assertActiveUser(userId);
    this.assertInitiateInput(input);

    const vibeId = randomUUID();
    const videoToken = randomBase64Url(32);
    const musicToken = input.music ? randomBase64Url(32) : null;
    const expiresAt = new Date(Date.now() + this.config.uploadTtlSeconds * 1000);
    const sourceObjectKey = `vibes/${userId}/${vibeId}/source${extensionForMime(input.video.mimeType)}`;
    const musicObjectKey = input.music
      ? `vibes/${userId}/${vibeId}/music${safeExtension(input.music.fileName, input.music.mimeType)}`
      : null;

    const videoInstruction = await this.objectStorage.createPresignedPutObject({
      bucket: this.storageConfig.bucketVibeMedia,
      objectKey: sourceObjectKey,
      mimeType: input.video.mimeType,
      uploadToken: videoToken,
      userId,
      sha256: null,
      expiresInSeconds: this.config.uploadTtlSeconds,
    });
    const musicInstruction = input.music && musicToken && musicObjectKey
      ? await this.objectStorage.createPresignedPutObject({
          bucket: this.storageConfig.bucketVibeMedia,
          objectKey: musicObjectKey,
          mimeType: input.music.mimeType,
          uploadToken: musicToken,
          userId,
          sha256: null,
          expiresInSeconds: this.config.uploadTtlSeconds,
        })
      : null;

    await this.prisma.vibeMedia.create({
      data: {
        id: vibeId,
        userId,
        status: "UPLOADING",
        filter: input.filter,
        audioMode: input.audioMode,
        sourceBucket: this.storageConfig.bucketVibeMedia,
        sourceObjectKey,
        sourceMimeType: input.video.mimeType,
        sourceSizeBytes: input.video.sizeBytes,
        sourceUploadTokenHash: hashToken(videoToken),
        musicBucket: input.music ? this.storageConfig.bucketVibeMedia : null,
        musicObjectKey,
        musicMimeType: input.music?.mimeType ?? null,
        musicSizeBytes: input.music?.sizeBytes ?? null,
        musicName: input.music?.fileName ?? null,
        musicUploadTokenHash: musicToken ? hashToken(musicToken) : null,
        uploadExpiresAt: expiresAt,
      },
    });

    return {
      vibeId,
      video: toUploadDto(videoToken, sourceObjectKey, this.storageConfig.bucketVibeMedia, videoInstruction, this.config.maxVideoSizeBytes),
      music: musicInstruction && musicToken && musicObjectKey
        ? toUploadDto(musicToken, musicObjectKey, this.storageConfig.bucketVibeMedia, musicInstruction, this.config.maxMusicSizeBytes)
        : null,
    };
  }

  async finalize(userId: string, vibeId: string, input: FinalizeVibeUploadDto) {
    const vibe = await this.prisma.vibeMedia.findUnique({ where: { id: vibeId } });
    this.assertOwned(vibe, userId);
    if (vibe.status === "PROCESSING" || vibe.status === "READY") {
      return { vibe: await this.mapDto(vibe) };
    }
    if (vibe.status !== "UPLOADING" || vibe.uploadExpiresAt.getTime() < Date.now()) {
      throw new AppException(400, ERROR_CODES.VIBE_UPLOAD_INVALID, "Vibe upload is invalid or expired");
    }

    this.assertFinalizeAsset(input.video, {
      userId,
      bucket: vibe.sourceBucket,
      objectKey: vibe.sourceObjectKey,
      mimeType: vibe.sourceMimeType,
      sizeBytes: vibe.sourceSizeBytes,
      tokenHash: vibe.sourceUploadTokenHash,
    });
    await this.assertUploadedObject(input.video, userId);

    if (vibe.audioMode === "CUSTOM") {
      if (!input.music || !vibe.musicBucket || !vibe.musicObjectKey || !vibe.musicMimeType || !vibe.musicSizeBytes || !vibe.musicUploadTokenHash) {
        throw new AppException(400, ERROR_CODES.VIBE_UPLOAD_INVALID, "Custom Vibe audio is missing");
      }
      this.assertFinalizeAsset(input.music, {
        userId,
        bucket: vibe.musicBucket,
        objectKey: vibe.musicObjectKey,
        mimeType: vibe.musicMimeType,
        sizeBytes: vibe.musicSizeBytes,
        tokenHash: vibe.musicUploadTokenHash,
      });
      await this.assertUploadedObject(input.music, userId);
    } else if (input.music) {
      throw new AppException(400, ERROR_CODES.VIBE_UPLOAD_INVALID, "Music is not expected for this Vibe");
    }

    const transitioned = await this.prisma.vibeMedia.updateMany({
      where: { id: vibeId, userId, status: "UPLOADING", deletedAt: null },
      data: { status: "PROCESSING", failureReason: null },
    });
    const processing = await this.prisma.vibeMedia.findUniqueOrThrow({ where: { id: vibeId } });
    if (transitioned.count > 0) {
      try {
        await this.queue.enqueue("vibe.media.process", { vibeId }, { jobId: `vibe.media.process:${vibeId}` });
      } catch (cause) {
        await this.prisma.vibeMedia.update({
          where: { id: vibeId },
          data: { status: "FAILED", failureReason: "Processing could not be started" },
        });
        this.logger.error(`Failed to enqueue Vibe processing ${vibeId}`, cause instanceof Error ? cause.stack : undefined);
        throw new AppException(503, ERROR_CODES.INTERNAL_ERROR, "Vibe processing could not be started");
      }
    }
    return { vibe: await this.mapDto(processing) };
  }

  async getMine(userId: string) {
    const vibe = await this.prisma.vibeMedia.findFirst({
      where: { userId, deletedAt: null, status: { not: "REMOVED" } },
      orderBy: { createdAt: "desc" },
    });
    return { vibe: vibe ? await this.mapDto(vibe) : null };
  }

  async getForUser(viewerId: string, targetUserId: string) {
    const blocked = viewerId === targetUserId
      ? null
      : await this.prisma.block.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { blockerId: viewerId, blockedId: targetUserId },
              { blockerId: targetUserId, blockedId: viewerId },
            ],
          },
          select: { id: true },
        });
    if (blocked) return { vibe: null };
    // Do not let a video or its thumbnail bypass the relationship photo policy.
    if (!(await this.objectStorage.canDiscloseMedia({ viewerId, ownerId: targetUserId }))) return { vibe: null };
    const vibe = await this.prisma.vibeMedia.findFirst({
      where: {
        userId: targetUserId,
        status: "READY",
        moderationStatus: "APPROVED",
        deletedAt: null,
        user: { status: "ACTIVE", deletedAt: null, isShadowBanned: false },
      },
      orderBy: { readyAt: "desc" },
    });
    return { vibe: vibe ? await this.mapDto(vibe) : null };
  }

  async remove(userId: string, vibeId: string): Promise<void> {
    const vibe = await this.prisma.vibeMedia.findUnique({ where: { id: vibeId } });
    this.assertOwned(vibe, userId);
    if (vibe.status === "REMOVED") return;
    await this.prisma.vibeMedia.update({
      where: { id: vibeId },
      data: { status: "REMOVED", deletedAt: new Date() },
    });
    const objects = [
      [vibe.sourceBucket, vibe.sourceObjectKey],
      [vibe.musicBucket, vibe.musicObjectKey],
      [vibe.processedBucket, vibe.processedObjectKey],
      [vibe.thumbnailBucket, vibe.thumbnailObjectKey],
    ].filter((pair): pair is [string, string] => Boolean(pair[0] && pair[1]));
    await Promise.allSettled(objects.map(([bucket, objectKey]) => this.objectStorage.deleteObject({ bucket, objectKey })));
  }

  private assertInitiateInput(input: InitiateVibeUploadDto): void {
    if (!VIDEO_MIME_TYPES.has(input.video.mimeType) || input.video.sizeBytes > this.config.maxVideoSizeBytes) {
      throw new AppException(400, ERROR_CODES.VIBE_INVALID_MEDIA, "Vibe video must be an MP4 or MOV within the size limit");
    }
    if (input.audioMode === "CUSTOM" && !input.music) {
      throw new AppException(400, ERROR_CODES.VIBE_INVALID_MEDIA, "Choose an audio file for custom music");
    }
    if (input.audioMode !== "CUSTOM" && input.music) {
      throw new AppException(400, ERROR_CODES.VIBE_INVALID_MEDIA, "Audio file is only allowed with custom music");
    }
    if (input.music && (!MUSIC_MIME_TYPES.has(input.music.mimeType) || input.music.sizeBytes > this.config.maxMusicSizeBytes)) {
      throw new AppException(400, ERROR_CODES.VIBE_INVALID_MEDIA, "Vibe music type or size is not supported");
    }
  }

  private assertFinalizeAsset(asset: FinalizeVibeAssetDto, expected: {
    userId: string;
    bucket: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    tokenHash: string;
  }): void {
    if (
      asset.bucket !== expected.bucket ||
      asset.objectKey !== expected.objectKey ||
      asset.mimeType !== expected.mimeType ||
      asset.sizeBytes !== expected.sizeBytes ||
      !safeEqualHex(hashToken(asset.uploadToken), expected.tokenHash)
    ) {
      throw new AppException(400, ERROR_CODES.VIBE_UPLOAD_INVALID, "Vibe upload metadata does not match");
    }
  }

  private async assertUploadedObject(asset: FinalizeVibeAssetDto, userId: string): Promise<void> {
    const head = await this.objectStorage.headObject({ bucket: asset.bucket, objectKey: asset.objectKey });
    if (
      head.sizeBytes !== asset.sizeBytes ||
      head.mimeType !== asset.mimeType ||
      head.metadata["aroha-user-id"] !== userId ||
      head.metadata["aroha-upload-token"] !== asset.uploadToken
    ) {
      throw new AppException(400, ERROR_CODES.VIBE_UPLOAD_INVALID, "Uploaded Vibe file does not match the request");
    }
  }

  private async assertActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, status: "ACTIVE", deletedAt: null }, select: { id: true } });
    if (!user) throw new AppException(403, ERROR_CODES.FORBIDDEN, "Account cannot publish a Vibe");
  }

  private assertOwned(vibe: NonNullable<VibeRecord> | null, userId: string): asserts vibe is NonNullable<VibeRecord> {
    if (!vibe) throw new AppException(404, ERROR_CODES.VIBE_NOT_FOUND, "Vibe not found");
    if (vibe.userId !== userId) throw new AppException(403, ERROR_CODES.VIBE_NOT_OWNED, "Vibe is not owned by this account");
  }

  private async mapDto(vibe: NonNullable<VibeRecord>): Promise<VibeDto> {
    const playbackUrl = vibe.status === "READY" && vibe.processedBucket && vibe.processedObjectKey
      ? await this.objectStorage.createPresignedGetObject({
          bucket: vibe.processedBucket,
          objectKey: vibe.processedObjectKey,
          expiresInSeconds: this.config.playbackUrlTtlSeconds,
        })
      : null;
    const thumbnailUrl = vibe.status === "READY" && vibe.thumbnailBucket && vibe.thumbnailObjectKey
      ? await this.objectStorage.createPresignedGetObject({
          bucket: vibe.thumbnailBucket,
          objectKey: vibe.thumbnailObjectKey,
          expiresInSeconds: this.config.playbackUrlTtlSeconds,
        })
      : null;
    return {
      id: vibe.id,
      userId: vibe.userId,
      status: vibe.status,
      filter: vibe.filter,
      audioMode: vibe.audioMode,
      musicName: vibe.musicName,
      durationMs: vibe.durationMs,
      playbackUrl,
      thumbnailUrl,
      failureReason: vibe.failureReason,
      createdAt: vibe.createdAt.toISOString(),
      updatedAt: vibe.updatedAt.toISOString(),
    };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function extensionForMime(mimeType: string): string {
  return mimeType === "video/quicktime" ? ".mov" : ".mp4";
}

function safeExtension(fileName: string, mimeType: string): string {
  const extension = extname(fileName).toLowerCase();
  if (/^\.[a-z0-9]{1,6}$/.test(extension)) return extension;
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  if (mimeType.includes("aac")) return ".aac";
  return ".mp3";
}

function toUploadDto(
  uploadToken: string,
  objectKey: string,
  bucket: string,
  instruction: { uploadUrl: string; headers: Record<string, string>; expiresAt: Date },
  maxSizeBytes: number,
) {
  return {
    uploadToken,
    objectKey,
    bucket,
    method: "PUT" as const,
    uploadUrl: instruction.uploadUrl,
    headers: instruction.headers,
    expiresAt: instruction.expiresAt.toISOString(),
    maxSizeBytes,
  };
}
