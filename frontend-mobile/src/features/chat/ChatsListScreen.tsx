import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { conversationsApi } from "../../api/endpoints/conversations";
import { NotificationButton, VerificationBadge } from "../../components/dating";
import { TabHeader } from "../../components/layout/TabHeader";
import { useBottomNavigationInset } from "../../components/navigation/bottomNavigation";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";
import { Text } from "../../components/ui/Text";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { layout, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { ConversationSummaryDto } from "../../types/conversation";
import { formatRelativeTime } from "../../utils/format";

export const ChatsListScreen: React.FC = () => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();
  const bottomNavigationInset = useBottomNavigationInset();
  const realtime = useRealtime();
  const [items, setItems] = useState<ConversationSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    try {
      mode === "initial" ? setLoading(true) : setRefreshing(true);
      const page = await conversationsApi.list({ limit: 30 });
      setItems(page.items.filter((item) => item.status === "ACTIVE"));
      setError(null);
    } catch {
      setError("Check your connection and try loading your conversations again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("initial");
    }, [load]),
  );

  useEffect(
    () =>
      realtime.onMessageCreated(({ message, conversationId }) => {
        setItems((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  lastMessageSequence: message.sequence,
                  lastMessagePreview: message.textBody ?? conversation.lastMessagePreview,
                  lastMessageType: message.type,
                  lastMessageSentAt: message.createdAt,
                  lastSenderId: message.senderId,
                  unreadCount: conversation.unreadCount + 1,
                }
              : conversation,
          ),
        );
      }),
    [realtime],
  );

  const unread = items.reduce((count, item) => count + item.unreadCount, 0);
  useEffect(() => realtime.onConversationClosed(({ conversationId }) => {
    setItems(current => current.filter(item => item.id !== conversationId));
  }), [realtime]);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <TabHeader
          title="Chats"
          right={<NotificationButton unread={unread > 0} />}
        />
        {loading ? (
          <Text variant="body" color="textSubdued" style={styles.loading}>
            Loading chats…
          </Text>
        ) : error ? (
          <EmptyState
            title="Chats didn’t load"
            body={error}
            actionLabel="Try again"
            onAction={() => void load("initial")}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No chats yet"
            petalAccent
            actionLabel="View connections"
            onAction={() => router.push("/(app)/(tabs)/connections")}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(conversation) => conversation.id}
            style={{ marginBottom: Math.max(bottomNavigationInset - spacing.md, 0) }}
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load("refresh")}
                tintColor={palette.brandStrong}
                colors={[palette.brandStrong]}
                progressBackgroundColor={palette.surface}
              />
            }
            renderItem={({ item: conversation }) => {
              const isDuo = conversation.kind === "DUO";
              const name = isDuo ? "Duo chat" : conversation.otherUser.displayName;
              const photo =
                conversation.otherUser.photos.find((item) => item.isPrimary)?.url ??
                conversation.otherUser.photos[0]?.url;
              return (
                <Pressable
                  key={conversation.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${name}`}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/conversation/[conversationId]",
                      params: { conversationId: conversation.id },
                    })
                  }
                  style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
                >
                  <Avatar size={44} uri={isDuo ? undefined : photo} initials={name} />
                  <View style={styles.rowText}>
                    <View style={styles.topLine}>
                      <View style={styles.nameLine}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {name}
                        </Text>
                        {!isDuo ? <VerificationBadge
                          status={conversation.otherUser.verificationStatus}
                          compact
                        /> : null}
                      </View>
                      <Text variant="micro" color="textSubdued">
                        {formatRelativeTime(conversation.lastMessageSentAt)}
                      </Text>
                    </View>
                    <View style={styles.previewLine}>
                      <Text
                        variant="caption"
                        color={conversation.unreadCount > 0 ? "textPrimary" : "textSubdued"}
                        numberOfLines={1}
                        style={styles.preview}
                      >
                        {conversation.lastMessagePreview ??
                          (isDuo ? conversation.participants.map(member => member.displayName).join(" · ") : "No messages yet")}
                      </Text>
                      {conversation.unreadCount > 0 ? (
                        <View style={styles.unread}>
                          <Text variant="micro" color="textOnBrand">
                            {conversation.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  loading: { padding: spacing.lg },
  content: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  rowText: { flex: 1, minWidth: 0, gap: spacing.xs },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  nameLine: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  previewLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  preview: { flex: 1, minWidth: 0 },
  unread: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.brandStrong,
  },
  pressed: { opacity: 0.7 },
}));
