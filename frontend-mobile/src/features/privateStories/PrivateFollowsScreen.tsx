import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { privateStoriesApi } from "../../api/endpoints/privateStories";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useResponsiveLayout } from "../../theme/responsive";
import { useTheme } from "../../theme/ThemeContext";
import { controlSize, spacing } from "../../theme/spacing";

type FollowTab = "followers" | "following" | "requests";
type FollowRow = { userId: string; displayName: string; city: string | null; photoUrl: string | null };
const isTab = (value: string | undefined): value is FollowTab => value === "followers" || value === "following" || value === "requests";
const tabs: FollowTab[] = ["followers", "following", "requests"];

export function PrivateFollowsScreen() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();
  const stackRow = responsive.accessibilityLayout;
  const [tab, setTab] = useState<FollowTab>(isTab(initialTab) ? initialTab : "followers");
  const [summary, setSummary] = useState<{ followers: number; following: number; requests: number } | null>(null);
  const [rows, setRows] = useState<FollowRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const fetchPage = useCallback(async (next?: string) => {
    const page = tab === "followers" ? await privateStoriesApi.followers(next)
      : tab === "following" ? await privateStoriesApi.following(next)
        : await privateStoriesApi.followRequests(next);
    return { items: page.items.map(item => ({ userId: "requesterId" in item ? item.requesterId : item.userId, displayName: item.displayName, city: item.city, photoUrl: item.photoUrl })), nextCursor: page.nextCursor };
  }, [tab]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setLoadingMore(false); setError(null); setRows([]); setCursor(null);
    try {
      const [totals, page] = await Promise.all([privateStoriesApi.followSummary(), fetchPage()]);
      if (version !== requestVersion.current) return;
      setSummary(totals); setRows(page.items); setCursor(page.nextCursor);
    } catch { if (version === requestVersion.current) setError("Couldn’t load your connections. Try again."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [fetchPage]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]));

  const loadMore = async () => {
    if (!cursor || loadingMore || loading) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      if (version !== requestVersion.current) return;
      setRows(current => [...current, ...page.items.filter(item => !current.some(existing => existing.userId === item.userId))]);
      setCursor(page.nextCursor);
    } catch { if (version === requestVersion.current) setError("Couldn’t load more follows. Try again."); }
    finally { if (version === requestVersion.current) setLoadingMore(false); }
  };

  const change = async (person: FollowRow, action: "approve" | "decline" | "remove" | "unfollow") => {
    if (busyId) return;
    setBusyId(person.userId); setError(null);
    try {
      if (action === "approve") await privateStoriesApi.approveFollow(person.userId);
      if (action === "decline" || action === "remove") await privateStoriesApi.revokeFollow(person.userId);
      if (action === "unfollow") await privateStoriesApi.cancelFollow(person.userId);
      await load();
    } catch { setError("Couldn’t update this follow. Try again."); }
    finally { setBusyId(null); }
  };

  const confirmChange = (person: FollowRow, action: "remove" | "unfollow") => {
    Alert.alert(action === "remove" ? "Remove follower?" : "Unfollow?",
      "This removes the follow. Story access also depends on each Story’s audience and any active match.", [
        { text: "Cancel", style: "cancel" },
        { text: action === "remove" ? "Remove" : "Unfollow", style: "destructive", onPress: () => void change(person, action) },
      ]);
  };

  const title = tab === "followers" ? "No followers yet" : tab === "following" ? "You’re not following anyone yet" : "All caught up";
  const description = tab === "followers" ? "People you approve will appear here." : tab === "following" ? "People you follow will appear here." : "New follow requests will appear here.";
  return <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
    <View style={[styles.header, { paddingHorizontal: responsive.screenPadding }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Icon name="arrowLeft" size={22} color={palette.textPrimary} /></Pressable>
      <Text variant="titleSm">Your circle</Text>
      <View style={styles.back} />
    </View>
    <FlatList
      data={rows}
      keyExtractor={item => item.userId}
      contentContainerStyle={[styles.content, { maxWidth: responsive.contentMaxWidth, paddingHorizontal: responsive.screenPadding }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListHeaderComponent={<View style={styles.intro}>
        <View style={[styles.tabs, { borderBottomColor: palette.borderSubdued }]}>
          {tabs.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} disabled={!!busyId} onPress={() => { requestVersion.current += 1; setTab(value); }} style={[styles.tab, tab === value && { borderBottomColor: palette.brand }]}>
            <Text variant="captionStrong" color={tab === value ? "textPrimary" : "textSubdued"} numberOfLines={1} align="center">{value === "followers" ? "Followers" : value === "following" ? "Following" : "Requests"}</Text>
            {summary ? <Text variant="micro" color={tab === value ? "textBrand" : "textSubdued"} align="center">{summary[value]}</Text> : null}
          </Pressable>)}
        </View>
        {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
        {error ? <Button label="Retry" variant="secondary" size="sm" onPress={() => void load()} /> : null}
        {loading ? <Text variant="caption" color="textSubdued">Loading follows…</Text> : null}
      </View>}
      ListEmptyComponent={!loading && !error ? <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.borderSubdued }]}>
        <View style={[styles.emptyIcon, { backgroundColor: palette.surfaceSubdued }]}><Icon name="people" size={24} color={palette.brandSecondary} /></View>
        <Text variant="bodyStrong" align="center">{title}</Text><Text variant="caption" color="textSubdued" align="center">{description}</Text>
      </View> : null}
      renderItem={({ item }) => <View style={[styles.row, stackRow && styles.stackedRow, { borderBottomColor: palette.borderSubdued }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.displayName}'s profile`} onPress={() => router.push({ pathname: "/(app)/profile/[userId]", params: { userId: item.userId } })} style={[styles.person, stackRow && styles.stackedPerson]}>
          <View style={[styles.avatar, { backgroundColor: palette.surfaceSubdued }]}>{item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} /> : <Text variant="captionStrong" color="textBrand">{item.displayName.trim().slice(0, 1).toUpperCase() || "?"}</Text>}</View>
          <View style={styles.personText}><Text variant="captionStrong" numberOfLines={1}>{item.displayName}</Text><Text variant="micro" color="textSubdued" numberOfLines={1}>{item.city || "Yariva member"}</Text></View>
        </Pressable>
        {tab === "requests" ? <View style={[styles.actions, stackRow && styles.stackedActions]}>
          <Button label="Accept" size="sm" style={styles.requestAction} loading={busyId === item.userId} disabled={!!busyId} onPress={() => void change(item, "approve")} />
          <Button label="Decline" size="sm" style={styles.requestAction} variant="outline" disabled={!!busyId} onPress={() => void change(item, "decline")} />
        </View> : <Button label={tab === "followers" ? "Remove" : "Following"} size="sm" variant="ghost" disabled={!!busyId} onPress={() => confirmChange(item, tab === "followers" ? "remove" : "unfollow")} />}
      </View>}
      ListFooterComponent={cursor ? <Button label={loadingMore ? "Loading…" : "Load more"} variant="ghost" disabled={loadingMore} onPress={() => void loadMore()} /> : null}
      style={styles.list}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, list: { flex: 1 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: controlSize.minimumTouchTarget, height: controlSize.minimumTouchTarget, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", alignSelf: "center", paddingBottom: spacing.xxl },
  intro: { gap: spacing.sm, paddingBottom: spacing.sm },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 48, borderBottomWidth: 2, borderBottomColor: "transparent", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  row: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  stackedRow: { flexDirection: "column", alignItems: "stretch", paddingVertical: spacing.sm },
  person: { flex: 1, minWidth: 0, minHeight: controlSize.minimumTouchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stackedPerson: { flex: 0, width: "100%" },
  avatar: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%" },
  personText: { flex: 1, minWidth: 0, gap: 2 },
  actions: { flexDirection: "row", gap: spacing.xs, justifyContent: "flex-end" },
  stackedActions: { width: "100%" },
  requestAction: { minWidth: 66 },
  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxl, borderWidth: 1, borderRadius: 18, marginTop: spacing.sm },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
});
