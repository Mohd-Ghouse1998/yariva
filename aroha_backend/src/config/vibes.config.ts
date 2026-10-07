import { registerAs } from "@nestjs/config";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

export default registerAs("vibes", () => ({
  enabled: (process.env.VIBES_ENABLED ?? "true") === "true",
  maxDurationSeconds: Number(process.env.VIBE_MAX_DURATION_SECONDS ?? 5),
  maxVideoSizeBytes: Number(process.env.VIBE_MAX_VIDEO_SIZE_BYTES ?? 40 * 1024 * 1024),
  maxMusicSizeBytes: Number(process.env.VIBE_MAX_MUSIC_SIZE_BYTES ?? 12 * 1024 * 1024),
  uploadTtlSeconds: Number(process.env.VIBE_UPLOAD_TTL_SECONDS ?? 15 * 60),
  playbackUrlTtlSeconds: Number(process.env.VIBE_PLAYBACK_URL_TTL_SECONDS ?? 15 * 60),
  ffmpegPath: process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? ffprobe.path,
  moderationProvider:
    process.env.VIBE_MODERATION_PROVIDER ??
    (process.env.NODE_ENV === "production" ? "manual" : "local-development-stub"),
}));
