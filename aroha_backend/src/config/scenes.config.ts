import { registerAs } from "@nestjs/config";

export default registerAs("scenes", () => ({
  lifetimeHours: Number(process.env.SCENE_LIFETIME_HOURS ?? 12),
  radiusMeters: Number(process.env.SCENE_RADIUS_METERS ?? 15_000),
  locationMaxAgeHours: Number(process.env.SCENE_LOCATION_MAX_AGE_HOURS ?? 168),
  discoveryCacheSeconds: Number(process.env.SCENE_DISCOVERY_CACHE_SECONDS ?? 120),
}));
