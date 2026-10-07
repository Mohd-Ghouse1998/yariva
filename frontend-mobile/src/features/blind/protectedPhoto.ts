// Public originals are signed HTTPS URLs. Never replace the server's anonymous
// PNG slot with a cached original, even when navigation revisits a profile.
export const isProtectedPhotoSource = (uri?: string | null) => Boolean(uri?.startsWith("data:image/png;base64,"));
