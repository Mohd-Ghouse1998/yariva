import { type Href, useRouter } from "expo-router";
import { useCallback } from "react";
import { chooseSafeBackAction } from "./safeBackDecision";

/**
 * Returns a back handler that also works when a screen was opened from a deep
 * link or a fresh browser tab with no navigation history.
 */
export const useSafeBack = (fallback: Href): (() => void) => {
  const router = useRouter();

  return useCallback(() => {
    if (chooseSafeBackAction(router.canGoBack()) === "back") {
      router.back();
      return;
    }
    router.replace(fallback);
  }, [fallback, router]);
};
