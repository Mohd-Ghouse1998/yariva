import type { SceneDto } from "../../types/scenes";

export const sceneMineAction = (scene: Pick<SceneDto, "status" | "expiresAt"> | null, now: number): "VIEW" | "CREATE" | "REVIEW_RENEW" => {
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
