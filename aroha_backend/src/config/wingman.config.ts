import { registerAs } from "@nestjs/config";

export default registerAs("wingman", () => ({
  invitationTtlHours: Number(process.env.WINGMAN_INVITATION_TTL_HOURS ?? 48),
  tokenPepper:
    process.env.WINGMAN_INVITE_TOKEN_PEPPER ??
    process.env.PASSWORD_PEPPER ??
    "",
  deepLinkBase: process.env.WINGMAN_DEEP_LINK_BASE ?? "yariva://wingman/invite",
  discoveryRadiusMeters: Number(
    process.env.WINGMAN_DISCOVERY_RADIUS_METERS ?? 15_000,
  ),
  locationMaxAgeHours: Number(
    process.env.WINGMAN_LOCATION_MAX_AGE_HOURS ?? 168,
  ),
  discoveryCacheSeconds: Number(
    process.env.WINGMAN_DISCOVERY_CACHE_SECONDS ?? 60,
  ),
}));
