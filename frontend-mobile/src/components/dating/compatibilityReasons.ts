export const uniqueCompatibilityReasons = (
  reasons: string[],
  scheduleOverlap?: string | null,
): string[] => {
  const scheduleKey = scheduleOverlap?.trim().toLocaleLowerCase() ?? null;
  const seen = new Set<string>();

  return reasons.filter((reason) => {
    const key = reason.trim().toLocaleLowerCase();
    if (!key || key === scheduleKey || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
