import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  name: process.env.APP_NAME ?? "aroha-backend",
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS ?? "",
  defaultThrottleTtlMs: 60_000,
  defaultThrottleLimit: 120,
}));
