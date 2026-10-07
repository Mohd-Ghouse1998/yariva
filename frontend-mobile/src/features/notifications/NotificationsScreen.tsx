import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { notificationsApi } from "../../api/endpoints/notifications";
import { Header, Screen } from "../../components/layout";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { NotificationDto, NotificationType } from "../../types/notifications";
import { formatRelativeTime } from "../../utils/format";
import { actorInitials, notificationDisplayCopy, resolveNotificationHref } from "./notificationNavigation";

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

export const NotificationsScreen: React.FC = () => {
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/discover");
  const realtime = useRealtime();
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

  const load = useCallback(
    async (mode: "initial" | "refresh" | "more") => {
      if (requestBusyRef.current) return;
      requestBusyRef.current = true;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      if (mode !== "more") setLoadError(false);
      try {
        const page = await notificationsApi.list({
          cursor: mode === "more" ? cursorRef.current : null,
          limit: 30,
        });
        setItems((current) => (mode === "more" ? mergeUnique(current, page.items) : page.items));
        cursorRef.current = page.nextCursor;
        setNextCursor(page.nextCursor);
      } catch {
        if (mode === "initial") setLoadError(true);
        else toast.show("Activity couldn’t refresh.", "error");
      } finally {
        requestBusyRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  useEffect(
    () =>
      realtime.onNotification(({ notification }) => {
        setItems((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ]);
      }),
    [realtime],
  );

  const handlePress = (notification: NotificationDto) => {
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
    void notificationsApi.read(notification.id).catch(() => {
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
        accessibilityLabel={`${unread ? "Unread. " : ""}${notificationDisplayCopy(item).title}. ${notificationDisplayCopy(item).body}`}
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
            {notificationDisplayCopy(item).title}
          </Text>
          <Text variant="caption" color="textSubdued" numberOfLines={2} style={{ marginTop: 1 }}>
            {notificationDisplayCopy(item).body}
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
