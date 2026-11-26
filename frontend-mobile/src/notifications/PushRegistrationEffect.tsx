import React, { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { notificationsApi } from "../api/endpoints/notifications";
import { useAuth } from "../auth/AuthContext";
import { isSocialNotificationRoute, resolveNotificationHref } from "../features/notifications/notificationNavigation";
import { syncPushRegistration } from "./pushRegistration";

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const social = notification.request.content.data?.route === "social-notification";
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: social, shouldSetBadge: false };
  },
});

export const PushRegistrationEffect: React.FC = () => {
  const { status, user } = useAuth();
  const router = useRouter();
  const handled = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Never prompt on app boot. A user who already granted the OS permission is
    // re-synced; first-time permission is requested from Communication settings.
    void syncPushRegistration(false).catch(() => undefined);
  }, [status, user?.id]);

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;
    let active = true;
    const open = async (response: Notifications.NotificationResponse | null) => {
      if (!active || response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const { route, notificationId } = response.notification.request.content.data ?? {};
      if (route !== "social-notification" || typeof notificationId !== "string" ||
          !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(notificationId) || handled.current === notificationId) return;
      handled.current = notificationId;
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      try {
        const notification = await notificationsApi.read(notificationId);
        if (!active || !isSocialNotificationRoute(notification.data?.route)) return;
        const href = resolveNotificationHref(notification);
        if (href) router.push(href);
      } catch {
        // The in-app list remains available if a notification expires or the network is unavailable.
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(response => void open(response));
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [router, status, user?.id]);

  return null;
};
