import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { likesApi } from "../../api/endpoints/likes";
import { matchesApi } from "../../api/endpoints/matches";
import { NotificationButton, SegmentedControl, VerificationBadge } from "../../components/dating";
import { TabHeader } from "../../components/layout/TabHeader";
import { useBottomNavigationInset } from "../../components/navigation/bottomNavigation";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { layout, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { ReceivedLikePreviewDto } from "../../types/discovery";
import type { MatchSummaryDto } from "../../types/match";
import { formatRelativeTime } from "../../utils/format";

type ConnectionView = "INTEREST" | "MATCHES";

export const ConnectionsScreen: React.FC = () => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();
  const bottomNavigationInset = useBottomNavigationInset();
  const [view, setView] = useState<ConnectionView>("INTEREST");
  const [likes, setLikes] = useState<ReceivedLikePreviewDto[]>([]);
  const [matches, setMatches] = useState<MatchSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialSelectionResolved = useRef(false);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    try {
      mode === "initial" ? setLoading(true) : setRefreshing(true);
      const [received, matchPage] = await Promise.all([
        likesApi.received({ limit: 30 }),
        matchesApi.list({ limit: 30 }),
      ]);
      setLikes(received.items);
      setMatches(matchPage.items);
      if (!initialSelectionResolved.current) {
        initialSelectionResolved.current = true;
        if (received.items.length === 0 && matchPage.items.length > 0) setView("MATCHES");
      }
      setError(null);
    } catch {
      setError("Check your connection and try loading Connections again.");
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

  const newMatches = useMemo(() => matches.filter((match) => !match.lastMessageSentAt), [matches]);
  const connectedMatches = useMemo(
    () => matches.filter((match) => Boolean(match.lastMessageSentAt)),
    [matches],
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <TabHeader title="Connections" right={<NotificationButton unread={likes.length > 0} />} />
        <View style={styles.segmentWrap}>
          <SegmentedControl
            value={view}
            onChange={setView}
            accessibilityLabel="Connections sections"
            options={[
              { value: "INTEREST", label: "Interested in you", count: likes.length },
              { value: "MATCHES", label: "Matches", count: matches.length },
            ]}
            variant="underline"
          />
        </View>

        <ScrollView
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
        >
          {loading ? (
            <Text variant="body" color="textSubdued">
              Loading connections…
            </Text>
          ) : error ? (
            <EmptyState
              title="Connections didn’t load"
              body={error}
              actionLabel="Try again"
              onAction={() => void load("initial")}
            />
          ) : view === "INTEREST" ? (
            likes.length > 0 ? (
              <View style={styles.group}>
                <Text variant="captionStrong" color="textSecondary" style={styles.groupLabel}>
                  New interest
                </Text>
                <View style={styles.list}>
                  {likes.map((like, index) => (
                    <Pressable
                      key={like.likeId}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${like.displayName}'s full profile`}
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/profile/[userId]",
                          params: { userId: like.actorUserId },
                        })
                      }
                      style={({ pressed }) => [
                        styles.rowCard,
                        index < likes.length - 1 ? styles.rowDivider : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Avatar uri={like.primaryPhotoUrl} initials={like.displayName} size={48} />
                      <View style={styles.rowText}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {like.displayName}, {like.age}
                        </Text>
                        <Text variant="caption" color="textSubdued" numberOfLines={1}>
                          {[like.city, like.region].filter(Boolean).join(", ")} ·{" "}
                          {formatRelativeTime(like.likedAt)}
                        </Text>
                        <Text variant="caption" color="textSecondary" numberOfLines={1}>
                          {like.introNote
                            ? `“${like.introNote}”`
                            : (like.headline ?? "View profile")}
                        </Text>
                      </View>
                      <Icon name="chevronRight" size={17} color={palette.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Icon name="people" size={25} color={palette.socialAccent} />
                </View>
                <Text variant="heading" align="center">
                  No new interest yet
                </Text>
                <Text
                  variant="caption"
                  color="textSecondary"
                  align="center"
                  style={styles.emptyBody}
                >
                  When someone is interested, you’ll see them here.
                </Text>
                <Button
                  label="View my profile"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push("/(app)/(tabs)/profile")}
                  style={styles.emptyAction}
                />
              </View>
            )
          ) : matches.length > 0 ? (
            <>
              <MatchGroup
                title="New matches"
                matches={newMatches}
                onOpen={(match) =>
                  router.push({ pathname: "/(app)/match/[matchId]", params: { matchId: match.id } })
                }
              />
              <MatchGroup
                title="Getting to know"
                matches={connectedMatches}
                onOpen={(match) =>
                  router.push({ pathname: "/(app)/match/[matchId]", params: { matchId: match.id } })
                }
              />
            </>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Icon name="heart" size={25} color={palette.socialAccent} />
              </View>
              <Text variant="heading" align="center">
                No mutual matches yet
              </Text>
              <Text variant="caption" color="textSecondary" align="center" style={styles.emptyBody}>
                Discover people and show your interest to make a connection.
              </Text>
              <Button
                label="Open Discover"
                variant="secondary"
                size="sm"
                onPress={() => router.push("/(app)/(tabs)/discover")}
                style={styles.emptyAction}
              />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const MatchGroup: React.FC<{
  title: string;
  matches: MatchSummaryDto[];
  onOpen: (match: MatchSummaryDto) => void;
}> = ({ title, matches, onOpen }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  if (matches.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text variant="captionStrong" color="textSecondary" style={styles.groupLabel}>
        {title}
      </Text>
      <View style={styles.list}>
        {matches.map((match, index) => {
          const photo =
            match.otherUser.photos.find((item) => item.isPrimary)?.url ??
            match.otherUser.photos[0]?.url;
          return (
            <Pressable
              key={match.id}
              onPress={() => onOpen(match)}
              accessibilityRole="button"
              accessibilityLabel={`Open connection with ${match.otherUser.displayName}`}
              style={({ pressed }) => [
                styles.rowCard,
                index < matches.length - 1 ? styles.rowDivider : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Avatar
                uri={photo}
                initials={match.otherUser.displayName}
                size={48}
                ring={!match.lastMessageSentAt}
              />
              <View style={styles.rowText}>
                <View style={styles.nameLine}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {match.otherUser.displayName}
                  </Text>
                  <VerificationBadge status={match.otherUser.verificationStatus} compact />
                </View>
                <Text variant="caption" color="textSubdued" numberOfLines={1}>
                  {match.lastMessagePreview ?? `Matched ${formatRelativeTime(match.matchedAt)}`}
                </Text>
              </View>
              <Icon name="chevronRight" size={17} color={palette.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  segmentWrap: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.sm },
  content: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  group: { gap: spacing.sm },
  groupLabel: { paddingHorizontal: spacing.xs },
  list: { backgroundColor: palette.surface, borderRadius: 14, overflow: "hidden" },
  rowCard: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.divider },
  rowText: { flex: 1, minWidth: 0, gap: spacing.xxs },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { backgroundColor: palette.surfaceMuted },
  emptyWrap: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceTint,
    marginBottom: spacing.lg,
  },
  emptyBody: { marginTop: spacing.xs, maxWidth: 260 },
  emptyAction: { marginTop: spacing.xl },
}));
