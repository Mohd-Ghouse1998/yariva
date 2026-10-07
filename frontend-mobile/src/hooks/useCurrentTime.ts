import { useEffect, useState } from "react";
import { AppState } from "react-native";

/** Refresh time-driven presentation while mounted and immediately on resume. */
export const useCurrentTime = () => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 15_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return now;
};
