import { registerAs } from "@nestjs/config";

const normalizePrivateKey = (value: string | undefined): string | null =>
  value?.trim() ? value.replace(/\\n/g, "\n") : null;

export default registerAs("push", () => ({
  requestTimeoutMs: Number(process.env.PUSH_REQUEST_TIMEOUT_MS ?? 8_000),
  fcm: {
    projectId: process.env.FCM_PROJECT_ID?.trim() || null,
    clientEmail: process.env.FCM_CLIENT_EMAIL?.trim() || null,
    privateKey: normalizePrivateKey(process.env.FCM_PRIVATE_KEY),
    authUrl: process.env.FCM_AUTH_URL ?? "https://oauth2.googleapis.com/token",
    apiBaseUrl: process.env.FCM_API_BASE_URL ?? "https://fcm.googleapis.com",
  },
  apns: {
    teamId: process.env.APNS_TEAM_ID?.trim() || null,
    keyId: process.env.APNS_KEY_ID?.trim() || null,
    privateKey: normalizePrivateKey(process.env.APNS_PRIVATE_KEY),
    bundleId: process.env.APNS_BUNDLE_ID?.trim() || null,
    host:
      process.env.APNS_USE_SANDBOX === "true"
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com",
  },
}));
