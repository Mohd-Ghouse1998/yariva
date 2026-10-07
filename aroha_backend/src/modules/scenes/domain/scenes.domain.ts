const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
  "some",
  "this",
  "today",
  "tonight",
]);

const ACTIVITY_ALIASES: Record<string, string> = {
  cafe: "coffee",
  café: "coffee",
  chai: "coffee",
  coffees: "coffee",
  cinema: "movie",
  film: "movie",
  films: "movie",
  movies: "movie",
  stroll: "walk",
  walking: "walk",
  workout: "gym",
  workouts: "gym",
};

export interface NormalizedSceneActivity {
  activity: string;
  canonicalActivity: string;
  activityTokens: string[];
}

export function normalizeSceneActivity(value: string): NormalizedSceneActivity {
  const activity = value.trim().replace(/\s+/g, " ");
  const tokens = activity
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => ACTIVITY_ALIASES[token] ?? token)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  const activityTokens = [...new Set(tokens)].sort();
  return {
    activity,
    canonicalActivity: activityTokens.join("-").slice(0, 80) || "open-plan",
    activityTokens,
  };
}

export function normalizeSceneTags(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()))]
    .filter((value) => /^[a-z0-9][a-z0-9-]{0,29}$/.test(value))
    .sort()
    .slice(0, 5);
}

export function sceneActivitiesOverlap(
  left: Pick<NormalizedSceneActivity, "canonicalActivity" | "activityTokens">,
  right: Pick<NormalizedSceneActivity, "canonicalActivity" | "activityTokens">,
): boolean {
  if (left.canonicalActivity === right.canonicalActivity) return true;
  const rightTokens = new Set(right.activityTokens);
  return left.activityTokens.some((token) => rightTokens.has(token));
}

export function sceneWindowsOverlap(
  left: { availableFrom: Date | null; availableUntil: Date | null },
  right: { availableFrom: Date | null; availableUntil: Date | null },
): "CONFIRMED" | "UNCONFIRMED" | "NONE" {
  if (
    !left.availableFrom ||
    !left.availableUntil ||
    !right.availableFrom ||
    !right.availableUntil
  ) {
    return "UNCONFIRMED";
  }
  return left.availableFrom < right.availableUntil && right.availableFrom < left.availableUntil
    ? "CONFIRMED"
    : "NONE";
}

export function isSceneActive(
  scene: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return scene.status === "ACTIVE" && scene.expiresAt.getTime() > now.getTime();
}

export function isWithinSceneRadius(distanceMeters: number, radiusMeters = 15_000): boolean {
  return Number.isFinite(distanceMeters) && distanceMeters <= radiusMeters;
}
