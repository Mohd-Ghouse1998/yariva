export const PRIVATE_STORY_POLICY = {
  lifetimeHours: 24,
  maxRecipients: 100,
  pageSize: 20,
  retentionDays: 30,
} as const;

export function activeStory(story: { expiresAt: Date; deletedAt: Date | null }, now: Date): boolean {
  return story.deletedAt === null && story.expiresAt > now;
}
