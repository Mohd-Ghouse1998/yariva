export function resolveMutualMeetAgain(
  responses: Array<boolean | null | undefined>,
): "MUTUAL" | null {
  const submitted = responses.filter((value): value is boolean => typeof value === "boolean");
  return submitted.length >= 2 && submitted.every(Boolean) ? "MUTUAL" : null;
}
