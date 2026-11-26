import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, Pressable, View } from "react-native";
import { notificationsApi } from "../../api/endpoints/notifications";
import { ApiError } from "../../api/errors";
import { Header, Screen } from "../../components/layout";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { useLocalization } from "../../localization/LocalizationContext";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { NotificationDto, NotificationType } from "../../types/notifications";
import { formatRelativeTime } from "../../utils/format";
import { actorInitials, isSocialNotificationRoute, notificationDisplayCopy, resolveNotificationHref } from "./notificationNavigation";

const SYSTEM_ICONS: Partial<Record<NotificationType, IconName>> = {
  REPORT_UPDATE: "shield",
  MODERATION_ACTION: "shield",
  SYSTEM: "bell",
  MISSED_CALL: "phone",
  DATE_PROPOSED: "calendar",
  DATE_ACCEPTED: "calendar",
  DATE_CHANGED: "calendar",
  DATE_CANCELLED: "calendar",
  DATE_REMINDER: "clock",
  SAFETY_CHECK_IN: "shield",
  MUTUAL_MEET_AGAIN: "heart",
};

const mergeUnique = (current: NotificationDto[], incoming: NotificationDto[]) => {
  const known = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !known.has(item.id))];
};

const needsRefresh = (route: unknown) =>
  isSocialNotificationRoute(route) || route === "private-story" || route === "event-plan-change";

export const NotificationsScreen: React.FC = () => {
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/discover");
  const realtime = useRealtime();
  const { t } = useLocalization();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useStyles();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const requestBusyRef = useRef(false);
  const focusedRef = useRef(false);
  const activeRef = useRef(AppState.currentState === "active");
  const requestVersion = useRef(0);
  const pendingOpen = useRef<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      if (requestBusyRef.current || !focusedRef.current || !activeRef.current) return;
      requestBusyRef.current = true;
      const version = ++requestVersion.current;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      if (mode !== "more") setLoadError(false);
      try {
        const page = await notificationsApi.list({
          cursor: mode === "more" ? cursorRef.current : null,
          limit: 30,
        });
        if (version !== requestVersion.current) return;
        setItems((current) => (mode === "more" ? mergeUnique(current, page.items) : page.items));
        cursorRef.current = page.nextCursor;
        setNextCursor(page.nextCursor);
      } catch {
        if (version !== requestVersion.current) return;
        if (mode === "initial") setLoadError(true);
        else toast.show("Activity couldn’t refresh.", "error");
      } finally {
        if (version === requestVersion.current) {
          requestBusyRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [toast],
  );

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    activeRef.current = AppState.currentState === "active";
    void load("initial");
    const clearPrivateActivity = () => {
      // Invalidate in-flight reads as well as removing already displayed rows.
      requestVersion.current++;
      requestBusyRef.current = false;
      pendingOpen.current = null;
      setItems(current => current.filter(item => !needsRefresh(item.data?.route)));
    };
    const unsubscribe = realtime.onNotification(({ notification }) => {
        if (!activeRef.current) return;
        if (needsRefresh(notification.data?.route)) {
          // Recheck the server policy instead of trusting an earlier event.
          void load("refresh");
          return;
        }
        setItems((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ]);
      });
    const appState = AppState.addEventListener("change", state => {
      activeRef.current = state === "active";
      if (activeRef.current) void load("refresh");
      else clearPrivateActivity();
    });
    return () => {
      focusedRef.current = false;
      unsubscribe();
      appState.remove();
      clearPrivateActivity();
    };
  }, [load, realtime]));

  const handlePress = (notification: NotificationDto) => {
    if (isSocialNotificationRoute(notification.data?.route)) {
      if (pendingOpen.current) return;
      pendingOpen.current = notification.id;
      void notificationsApi.read(notification.id).then(fresh => {
        if (pendingOpen.current !== notification.id) return;
        setItems(current => current.map(item => item.id === fresh.id ? fresh : item));
        const href = resolveNotificationHref(fresh);
        if (href) router.push(href);
      }).catch((error: unknown) => {
        if (pendingOpen.current !== notification.id) return;
        if (error instanceof ApiError && error.status === 404) {
          setItems(current => current.filter(item => item.id !== notification.id));
          toast.show("This activity is no longer available.", "info");
        } else toast.show("This activity couldn’t open. Try again.", "error");
      }).finally(() => {
        if (pendingOpen.current === notification.id) pendingOpen.current = null;
      });
      return;
    }
    const href = resolveNotificationHref(notification);
    if (href) router.push(href);
    else toast.show("This activity has no page to open.", "info");

    if (notification.status === "READ") return;
    setItems((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, status: "READ", readAt: new Date().toISOString() }
          : item,
      ),
    );
    void notificationsApi.read(notification.id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        setItems(current => current.filter(item => item.id !== notification.id));
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, status: notification.status, readAt: notification.readAt }
            : item,
        ),
      );
    });
  };

  const renderItem = ({ item }: { item: NotificationDto }) => {
    const unread = item.status !== "READ";
    return (
      <Pressable
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${unread ? "Unread. " : ""}${notificationDisplayCopy(item, t).title}. ${notificationDisplayCopy(item, t).body}`}
        style={({ pressed }) => [
          styles.row,
          unread ? styles.rowUnread : null,
          pressed ? { opacity: 0.72 } : null,
        ]}
      >
        {item.actor ? (
          <Avatar size={40} initials={actorInitials(item.actor.displayName)} />
        ) : (
          <View style={styles.iconTile}>
            <Icon name={SYSTEM_ICONS[item.type] ?? "bell"} size={19} color={palette.brandStrong} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ fontSize: 14 }}>
            {notificationDisplayCopy(item, t).title}
          </Text>
          <Text variant="caption" color="textSubdued" numberOfLines={2} style={{ marginTop: 1 }}>
            {notificationDisplayCopy(item, t).body}
          </Text>
          <Text variant="micro" color="textSubdued" style={{ marginTop: 3 }}>
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
        {unread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
      </Pressable>
    );
  };

  return (
    <Screen padded={false} edges={["top", "bottom", "left", "right"]}>
      <Header title="Activity" showBack onLeftPress={goBack} />
      {loading ? (
        <View style={styles.state} accessibilityRole="progressbar">
          <ActivityIndicator color={palette.brandStrong} />
          <Text variant="body" color="textSubdued" style={{ marginTop: 12 }}>
            Loading activity…
          </Text>
        </View>
      ) : loadError ? (
        <EmptyState
          title="Activity couldn’t load"
          body="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void load("initial")}
          illustration={<Icon name="warning" size={34} color={palette.error} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, items.length === 0 ? { flexGrow: 1 } : null]}
          refreshing={refreshing}
          onRefresh={() => void load("refresh")}
          ListEmptyComponent={<NotificationsEmpty />}
          ListFooterComponent={
            nextCursor ? (
              <Button
                label={loadingMore ? "Loading…" : "Load earlier activity"}
                variant="ghost"
                fullWidth
                loading={loadingMore}
                onPress={() => void load("more")}
                style={{ marginTop: 10 }}
              />
            ) : null
          }
        />
      )}
    </Screen>
  );
};

const NotificationsEmpty: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="bell" size={30} color={palette.brandStrong} />
      </View>
      <Text variant="titleSm" align="center">
        Quiet for now
      </Text>
      <Text variant="body" color="textSubdued" align="center" style={{ maxWidth: 280 }}>
        New matches, messages, calls, and date updates will appear here.
      </Text>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
  },
  rowUnread: {
    backgroundColor: palette.brandSubdued,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.brandSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.brandStrong,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.brandSubdued,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
}));
