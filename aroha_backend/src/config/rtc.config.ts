import { registerAs } from "@nestjs/config";

function splitCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries.length > 0 ? entries : fallback;
}

export default registerAs("rtc", () => ({
  stunUrls: splitCsv(process.env.RTC_STUN_URLS, []),
  turnUrls: splitCsv(process.env.RTC_TURN_URLS, []),
  turnUsername: process.env.RTC_TURN_USERNAME ?? null,
  turnCredential: process.env.RTC_TURN_CREDENTIAL ?? null,
  ringTimeoutSeconds: Number(process.env.RTC_RING_TIMEOUT_SECONDS ?? 30),
  connectTimeoutSeconds: Number(process.env.RTC_CONNECT_TIMEOUT_SECONDS ?? 60),
  voiceIntroductionsEnabled: process.env.RTC_VOICE_INTRODUCTIONS_ENABLED !== "false",
  introductionSuggestedSeconds: Number(process.env.RTC_INTRODUCTION_SUGGESTED_SECONDS ?? 180),
  signalTtlSeconds: Number(process.env.RTC_SIGNAL_TTL_SECONDS ?? 120),
}));
