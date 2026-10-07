import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Respect the system preference, including changes while a dialog is mounted. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      changed = true;
      if (active) setReduced(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !changed) setReduced(enabled);
      })
      .catch(() => {
        /* Unavailable preference keeps the conservative no-motion default. */
      });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
