import { registerAs } from "@nestjs/config";

export default registerAs("objectStorage", () => ({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? "",
  region: process.env.OBJECT_STORAGE_REGION ?? "auto",
  accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY ?? "",
  secretKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? "",
  forcePathStyle: (process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
  bucketProfilePhotos:
    process.env.OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS ?? "profile-photos",
  bucketMessageAttachments:
    process.env.OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS ??
    "message-attachments",
  bucketVibeMedia:
    process.env.OBJECT_STORAGE_BUCKET_VIBE_MEDIA ?? "vibe-media",
}));
