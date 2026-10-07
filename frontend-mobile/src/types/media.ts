export const PROFILE_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];

export const MESSAGE_ATTACHMENT_MIME_TYPES = [
  ...PROFILE_PHOTO_MIME_TYPES,
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
] as const;
export type MessageAttachmentMimeType = (typeof MESSAGE_ATTACHMENT_MIME_TYPES)[number];

export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const MESSAGE_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
export const UPLOAD_FILE_NAME_MAX_LENGTH = 255;

export const isProfilePhotoMimeType = (value: string): value is ProfilePhotoMimeType =>
  (PROFILE_PHOTO_MIME_TYPES as readonly string[]).includes(value);

export const isMessageImageMimeType = (value: string): value is ProfilePhotoMimeType =>
  isProfilePhotoMimeType(value);

export const normalizeUploadFileName = (
  value: string | null | undefined,
  fallback: string,
): string => (value?.trim() || fallback).slice(0, UPLOAD_FILE_NAME_MAX_LENGTH);
