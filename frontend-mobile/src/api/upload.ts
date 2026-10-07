// Helper for uploading binary files to a presigned URL returned by the backend.
// The backend returns { uploadUrl, uploadHeaders, objectKey, expiresAt }.
// We perform a single PUT (or POST when the upload host requires it) of the raw bytes.

export interface PresignedUploadDescriptor {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}

export interface UploadInput extends PresignedUploadDescriptor {
  // Local file path (file:// URI from a picker) or a Blob for web.
  uri: string;
  mimeType: string;
  // Optional progress callback (0..1). Not all platforms support it; ignored otherwise.
  onProgress?: (progress: number) => void;
}

export async function uploadToPresignedUrl(input: UploadInput): Promise<void> {
  const { uri, uploadUrl, uploadHeaders, mimeType } = input;

  if (uploadUrl.startsWith("fixture://")) {
    input.onProgress?.(1);
    return;
  }

  // Use XMLHttpRequest so we can hook upload progress on iOS / Android.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    Object.entries({ "Content-Type": mimeType, ...uploadHeaders }).forEach(([k, v]) => {
      try {
        xhr.setRequestHeader(k, v);
      } catch {
        // Some headers (eg. Host) are forbidden in some environments; ignore safely.
      }
    });

    if (input.onProgress) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          input.onProgress?.(ev.loaded / ev.total);
        }
      };
    }

    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    // React Native: passing { uri, type, name } turns the file into a binary stream
    // when sent as the body. For presigned PUT we instead want raw bytes; use fetch
    // to get a Blob from the file URI when XHR can't read file:// directly.
    fetch(uri)
      .then((r) => r.blob())
      .then((blob) => xhr.send(blob))
      .catch((err: unknown) => reject(err));
  });
}

/**
 * Blob URLs do not survive a browser refresh. Demo attachments therefore use
 * a data URL on web, while native keeps the picker-managed local file URI.
 */
export async function createPersistablePreviewUri(
  uri: string,
  mimeType: string,
): Promise<string> {
  if (Platform.OS !== "web" || uri.startsWith("data:")) return uri;
  try {
    const response = await fetch(uri);
    if (!response.ok) return uri;
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : uri);
      reader.onerror = () => resolve(uri);
      reader.readAsDataURL(blob.type ? blob : new Blob([blob], { type: mimeType }));
    });
  } catch {
    return uri;
  }
}
import { Platform } from "react-native";
