import type { SceneDto } from "../../types/scenes";

export const sceneMineAction = (
  scene: Pick<SceneDto, "status" | "expiresAt"> | null,
  now: number,
): "VIEW" | "CREATE" | "REVIEW_RENEW" => {
  if (!scene) return "CREATE";
  return scene.status === "ACTIVE" && Date.parse(scene.expiresAt) > now ? "VIEW" : "REVIEW_RENEW";
};

export function sceneRemainingLabel(expiresAt: string, now: number): string {
  const remainingMinutes = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function sceneElapsedProgress(createdAt: string, expiresAt: string, now: number): number {
  const startsAt = Date.parse(createdAt);
  const endsAt = Date.parse(expiresAt);
  const lifetime = endsAt - startsAt;
  if (!Number.isFinite(lifetime) || lifetime <= 0) return 1;
  return Math.min(1, Math.max(0, (now - startsAt) / lifetime));
}

export type AvailabilityChoice = "FLEXIBLE" | "NEXT_TWO_HOURS" | "TONIGHT";

/** null means no explicit time change: preserve an edit's original window. */
export function sceneAvailability(
  scene: Pick<SceneDto, "availableFrom" | "availableUntil" | "expiresAt"> | null,
  choice: AvailabilityChoice | null,
  now: number,
  lifetimeHours: number,
): { availableFrom: string | null; availableUntil: string | null } {
  if (choice === null && scene)
    return { availableFrom: scene.availableFrom, availableUntil: scene.availableUntil };
  if (!choice || choice === "FLEXIBLE") return { availableFrom: null, availableUntil: null };
  const expiry = scene ? Date.parse(scene.expiresAt) : now + lifetimeHours * 3_600_000;
  if (!Number.isFinite(expiry) || expiry <= now + 60_000)
    return { availableFrom: null, availableUntil: null };
  const tonight = new Date(now);
  tonight.setHours(23, 30, 0, 0);
  const end =
    choice === "NEXT_TWO_HOURS"
      ? now + 2 * 3_600_000
      : Math.max(now + 30 * 60_000, Math.min(tonight.getTime(), now + 8 * 3_600_000));
  return {
    availableFrom: new Date(now).toISOString(),
    availableUntil: new Date(Math.min(end, expiry - 1_000)).toISOString(),
  };
}
