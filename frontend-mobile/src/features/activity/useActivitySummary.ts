import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { activityApi } from "../../api/endpoints/activity";
import type { ActivitySummary } from "../../types/activity";

/** An unavailable optional rollout must never break the Profile dashboard. */
export const useActivitySummary = () => {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void activityApi
        .summary()
        .then((value) => {
          if (active) setSummary(value.enabled ? value : null);
        })
        .catch(() => {
          if (active) setSummary(null);
        });
      return () => {
        active = false;
      };
    }, []),
  );
  return summary;
};
