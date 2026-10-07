import { registerAs } from "@nestjs/config";

export default registerAs("database", () => ({
  url: process.env.DATABASE_URL ?? "",
  poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  connectionTimeoutMs: Number(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 5_000,
  ),
  idleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 300_000),
  maxLifetimeSeconds: Number(process.env.DATABASE_MAX_LIFETIME_SECONDS ?? 0),
}));
