import { useCallback, useEffect, useRef, useState } from "react";
import { profilesApi } from "../../api/endpoints/profiles";
import type { MyProfileDto } from "../../types/profile";

type ProfileHydrationState = {
  profile: MyProfileDto | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<MyProfileDto | null>;
};

export const useProfileHydration = (): ProfileHydrationState => {
  const requestVersion = useRef(0);
  const [profile, setProfile] = useState<MyProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const next = await profilesApi.me();
      if (requestVersion.current === version) setProfile(next);
      return next;
    } catch (cause) {
      if (requestVersion.current === version) {
        setProfile(null);
        setError(cause instanceof Error ? cause.message : "Couldn’t load your profile.");
      }
      return null;
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  return { profile, loading, error, reload };
};

