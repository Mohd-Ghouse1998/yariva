export interface ActivitySummary {
  enabled: boolean;
  currentStreak: number;
  longestStreak: number;
  balance: number;
  lastActivityDate: string | null;
  displayEnabled: boolean;
  recapNotificationsEnabled: boolean;
  serverDate: string;
}
export type ActivityPreferences = Pick<
  ActivitySummary,
  "displayEnabled" | "recapNotificationsEnabled"
>;
export interface WeeklyRecap {
  id: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  generatedAt: string;
  scenesPublished: number;
  plansAccepted: number;
  activityDays: number;
  pointsEarned: number;
  historyStartedAt: string;
  partialHistory: boolean;
  historyAvailable: boolean;
}
