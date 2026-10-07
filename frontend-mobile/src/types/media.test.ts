import { describe, expect, it } from "vitest";
import {
  isMessageImageMimeType,
  isProfilePhotoMimeType,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  normalizeUploadFileName,
  PROFILE_PHOTO_MAX_BYTES,
  UPLOAD_FILE_NAME_MAX_LENGTH,
} from "./media";

describe("backend-supported media types", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s for profile photos", (type) => {
    expect(isProfilePhotoMimeType(type)).toBe(true);
  });

  it.each(["image/heic", "image/gif", "application/pdf"])(
    "rejects %s before the profile API request",
    (type) => {
      expect(isProfilePhotoMimeType(type)).toBe(false);
    },
  );

  it("limits the current chat picker to backend-supported image attachments", () => {
    expect(isMessageImageMimeType("image/jpeg")).toBe(true);
    expect(isMessageImageMimeType("video/mp4")).toBe(false);
  });

  it("matches the backend upload-size limits", () => {
    expect(PROFILE_PHOTO_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(MESSAGE_ATTACHMENT_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it("keeps upload filenames within the backend DTO limit", () => {
    expect(normalizeUploadFileName("x".repeat(300), "fallback.jpg")).toHaveLength(
      UPLOAD_FILE_NAME_MAX_LENGTH,
    );
    expect(normalizeUploadFileName("  ", "fallback.jpg")).toBe("fallback.jpg");
  });
});
