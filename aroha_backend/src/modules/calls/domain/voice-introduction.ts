/** A small deterministic opener uses only the two users' currently public Scenes. */
export function selectIntroductionPrompt(scenes: readonly { activityTokens: string[]; intent: string }[]): string {
  if (scenes.length !== 2 || scenes[0]!.intent !== scenes[1]!.intent) return "general";
  const common = scenes[0]!.activityTokens.filter((token) => scenes[1]!.activityTokens.includes(token));
  if (common.some((token) => ["coffee", "chai", "cafe"].includes(token))) return "coffee";
  if (common.some((token) => ["food", "biryani", "dinner", "lunch"].includes(token))) return "food";
  if (common.some((token) => ["walk", "park", "outdoors"].includes(token))) return "walk";
  if (common.some((token) => ["study", "book", "books", "reading"].includes(token))) return "study";
  return "general";
}
