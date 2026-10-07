import { IsBoolean, IsOptional } from "class-validator";
export class ActivityPreferencesDto {
  @IsOptional() @IsBoolean() displayEnabled?: boolean;
  @IsOptional() @IsBoolean() recapNotificationsEnabled?: boolean;
}
export interface ActivitySummaryDto {
  enabled: boolean;
  currentStreak: number;
  longestStreak: number;
  balance: number;
  lastActivityDate: string | null;
  displayEnabled: boolean;
  recapNotificationsEnabled: boolean;
  serverDate: string;
}
export interface WeeklyRecapDto {
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
