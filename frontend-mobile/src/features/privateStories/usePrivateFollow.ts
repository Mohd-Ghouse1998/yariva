import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { privateStoriesApi } from "../../api/endpoints/privateStories";
import { useToast } from "../../components/ui/Toast";

type FollowStatus = "NONE" | "PENDING" | "APPROVED";

/** Follow state for Discover; Stories keep their own audience rules. */
export function usePrivateFollow(ownerId?: string) {
  const toast = useToast();
  const requestVersion = useRef(0);
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const version = ++requestVersion.current;
    setBusy(true);
    setStatus(null);
    try {
      const result = await privateStoriesApi.followStatus(ownerId);
      if (version === requestVersion.current) setStatus(result.status);
    } catch {
      if (version === requestVersion.current) setStatus(null);
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }, [ownerId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        requestVersion.current += 1;
      };
    }, [refresh]),
  );

  const change = useCallback(() => {
    if (!ownerId || busy) return;
    if (!status) {
      void refresh();
      return;
    }
    const current = status;
    const execute = async () => {
      const version = ++requestVersion.current;
      setBusy(true);
      try {
        if (current === "NONE") await privateStoriesApi.requestFollow(ownerId);
        else await privateStoriesApi.cancelFollow(ownerId);
        const result = await privateStoriesApi.followStatus(ownerId);
        if (version === requestVersion.current) setStatus(result.status);
      } catch {
        if (version === requestVersion.current) {
          setStatus(null);
          toast.show("Couldn’t update your follow. Tap to retry.", "error");
        }
      } finally {
        if (version === requestVersion.current) setBusy(false);
      }
    };
    if (current === "APPROVED") {
      Alert.alert(
        "Unfollow?",
        "This removes your follow. Story access still depends on each Story’s audience and any active match.",
        [
          { text: "Keep following", style: "cancel" },
          { text: "Unfollow", style: "destructive", onPress: () => void execute() },
        ],
      );
    } else void execute();
  }, [busy, ownerId, refresh, status, toast]);

  const label =
    status === "APPROVED"
      ? "Following"
      : status === "PENDING"
        ? "Requested"
        : status === "NONE"
          ? "Follow"
          : busy
            ? "Loading"
            : "Retry";
  return { status, busy, label, change };
}
