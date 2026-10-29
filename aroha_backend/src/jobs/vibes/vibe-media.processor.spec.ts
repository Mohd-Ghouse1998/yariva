import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffprobe from "ffprobe-static";
import {
  MediaToolTimeoutError,
  VibeMediaRejectedError,
  buildFfmpegArgs,
  probeMedia,
  runMediaTool,
  validateMusicProbe,
  validateProcessedProbe,
  validateSourceProbe,
} from "./vibe-media.processor";

describe("Vibe media validation", () => {
  it("accepts an exact five-second phone video", () => {
    const result = validateSourceProbe(
      {
        format: { duration: "5.000", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
        streams: [
          { codec_type: "video", codec_name: "h264", width: 1080, height: 1920 },
          { codec_type: "audio", codec_name: "aac" },
        ],
      },
      5,
    );

    expect(result.durationSeconds).toBe(5);
    expect(result.video.codec_name).toBe("h264");
  });

  it("rejects a clip beyond the encoder timebase tolerance", () => {
    expect(() =>
      validateSourceProbe(
        {
          format: { duration: "5.060" },
          streams: [{ codec_type: "video", codec_name: "h264", width: 720, height: 1280 }],
        },
        5,
      ),
    ).toThrow(VibeMediaRejectedError);
  });

  it("rejects media without exactly one video stream", () => {
    expect(() =>
      validateSourceProbe(
        {
          format: { duration: "4.2", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
          streams: [{ codec_type: "audio", codec_name: "aac" }],
        },
        5,
      ),
    ).toThrow("exactly one video stream");
  });

  it("rejects a mismatched or unreadable video container", () => {
    expect(() =>
      validateSourceProbe(
        {
          format: { duration: "4.2", format_name: "matroska,webm" },
          streams: [{ codec_type: "video", codec_name: "vp9", width: 720, height: 1280 }],
        },
        5,
      ),
    ).toThrow("container");
  });

  it("rejects custom audio longer than the source video", () => {
    expect(() =>
      validateMusicProbe(
        {
          format: { duration: "3.0", format_name: "mp3" },
          streams: [{ codec_type: "audio", codec_name: "mp3" }],
        },
        2,
      ),
    ).toThrow("cannot be longer");
  });

  it("accepts one finite audio-only stream within the source duration", () => {
    const result = validateMusicProbe(
      {
        format: { duration: "1.95", format_name: "mp3" },
        streams: [{ codec_type: "audio", codec_name: "mp3" }],
      },
      2,
    );

    expect(result.durationSeconds).toBe(1.95);
    expect(result.audio.codec_name).toBe("mp3");
  });

  it("requires the safe H.264 output rendition", () => {
    expect(() =>
      validateProcessedProbe(
        {
          format: { duration: "4.9" },
          streams: [{ codec_type: "video", codec_name: "vp9", width: 720, height: 1280 }],
        },
        5,
      ),
    ).toThrow("output validation");
  });

  it("mixes selected custom audio and applies the chosen filter", () => {
    const args = buildFfmpegArgs({
      videoInput: "/tmp/input",
      musicInput: "/tmp/music",
      videoOutput: "/tmp/output.mp4",
      filter: "WARM",
      audioMode: "CUSTOM",
      maxDurationSeconds: 5,
    });

    expect(args).toEqual(
      expect.arrayContaining(["-stream_loop", "-1", "-map", "1:a:0", "-shortest"]),
    );
    expect(args.join(" ")).toContain("colorbalance");
    expect(args).toContain("libx264");
  });

  it.each([
    ["zero-byte", Buffer.alloc(0)],
    ["malformed", Buffer.from("this is not a video")],
  ])("rejects a %s upload that ffprobe cannot decode", async (_label, bytes) => {
    const workspace = await mkdtemp(join(tmpdir(), "yariva-vibe-test-"));
    const input = join(workspace, "input.mp4");
    try {
      await writeFile(input, bytes);
      await expect(probeMedia(ffprobe.path, input)).rejects.toThrow(
        VibeMediaRejectedError,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
    // The real native decoder has a 30-second deadline, including cold startup.
  }, 35_000);

  it("distinguishes a decoder timeout from permanently invalid media", async () => {
    await expect(
      runMediaTool(
        process.execPath,
        ["-e", "setTimeout(() => {}, 5000)"],
        20,
      ),
    ).rejects.toThrow(MediaToolTimeoutError);
  });
});
