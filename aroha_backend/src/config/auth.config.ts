import { registerAs } from "@nestjs/config";

export default registerAs("auth", () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "",
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  refreshTokenGraceSeconds: Number(
    process.env.REFRESH_TOKEN_GRACE_SECONDS ?? 30,
  ),
  passwordPepper: process.env.PASSWORD_PEPPER ?? "",
  refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER ?? "",
}));
