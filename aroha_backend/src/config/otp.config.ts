import { registerAs } from "@nestjs/config";

export type OtpProviderName = "disabled" | "twilio" | "msg91";

const provider = (): OtpProviderName => {
  const value = (process.env.OTP_PROVIDER ?? "disabled").trim().toLowerCase();
  return value === "twilio" || value === "msg91" ? value : "disabled";
};

export default registerAs("otp", () => ({
  provider: provider(),
  challengeTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 600),
  resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  maxVerifyAttempts: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS ?? 5),
  requestTimeoutMs: Number(process.env.OTP_REQUEST_TIMEOUT_MS ?? 8_000),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID ?? "",
  },
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY ?? "",
    templateId: process.env.MSG91_TEMPLATE_ID ?? "",
  },
}));
