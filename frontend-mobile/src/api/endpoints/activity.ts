import { http } from "../http";
import type { ActivityPreferences, ActivitySummary, WeeklyRecap } from "../../types/activity";
export const activityApi = {
  summary: () => http.get<ActivitySummary>("activity/me"),
  recap: () => http.get<{ recap: WeeklyRecap }>("activity/recap"),
  preferences: (value: ActivityPreferences) =>
    http.patch<ActivitySummary>("activity/preferences", value),
};
