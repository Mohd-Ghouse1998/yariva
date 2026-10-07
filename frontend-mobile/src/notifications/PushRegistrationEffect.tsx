import React, { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useAuth } from "../auth/AuthContext";
import { syncPushRegistration } from "./pushRegistration";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const PushRegistrationEffect: React.FC = () => {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated") return;
    // Never prompt on app boot. A user who already granted the OS permission is
    // re-synced; first-time permission is requested from Communication settings.
    void syncPushRegistration(false).catch(() => undefined);
  }, [status]);

  return null;
};
