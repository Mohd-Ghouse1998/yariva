import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { datePlansApi } from "../../api/endpoints/datePlans";
import { eventsApi } from "../../api/endpoints/events";
import { matchesApi } from "../../api/endpoints/matches";
import { useAuth } from "../../auth/AuthContext";
import { DatePlanCard } from "../../components/datePlans";
import { SegmentedControl } from "../../components/dating";
import { TabHeader } from "../../components/layout/TabHeader";
import { useBottomNavigationInset } from "../../components/navigation/bottomNavigation";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useResponsiveLayout } from "../../theme/responsive";
import { controlSize, layout, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { DatePlanDto } from "../../types/datePlan";
import type { MatchSummaryDto } from "../../types/match";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { Header } from "../../components/layout/Header";
import { planView, type PlanView } from "./planPresentation";

export const DatePlansScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { palette } = useTheme();
  const styles = useStyles();
  const responsive = useResponsiveLayout();
  const bottomNavigationInset = useBottomNavigationInset();
  const [view, setView] = useState<PlanView>("UPCOMING");
  const now = useCurrentTime();
  const [plans, setPlans] = useState<DatePlanDto[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<MatchSummaryDto[]>([]);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchQuery, setMatchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventsEnabled, setEventsEnabled] = useState(false);
  const requestSequence = useRef(0);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    const requestId = ++requestSequence.current;
    mode === "initial" ? setLoading(true) : setRefreshing(true);
    void eventsApi.status().then((status) => {
      if (requestId === requestSequence.current) setEventsEnabled(status.enabled);
    }).catch(() => {
      if (requestId === requestSequence.current) setEventsEnabled(false);
    });
    try {
      const planPage = await datePlansApi.listMine({ limit: 30 });
      if (requestId !== requestSequence.current) return;
      setPlans(planPage.items);
      setError(null);
      setLoading(false);
      setRefreshing(false);

      // Names decorate the plan cards, but plans remain fully usable if this
      // optional request is unavailable or slower than the plan endpoint.
      void matchesApi
        .list({ limit: 30 })
        .then((matchPage) => {
          if (requestId !== requestSequence.current) return;
          setMatches(matchPage.items.filter((match) => match.status === "ACTIVE"));
          setNames(
            Object.fromEntries(
              matchPage.items.map((match) => [match.id, match.otherUser.displayName]),
            ),
          );
        })
        .catch(() => undefined);
    } catch {
      if (requestId !== requestSequence.current) return;
      setError("Check your connection and try loading your meetups again.");
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("initial");
      return () => {
        requestSequence.current += 1;
      };
    }, [load]),
  );

  const grouped = useMemo(
    () => ({
      UPCOMING: plans.filter(
        (plan) => planView({ ...plan, startAt: plan.proposedStartAt }, now) === "UPCOMING",
      ),
      PENDING: plans.filter(
        (plan) => planView({ ...plan, startAt: plan.proposedStartAt }, now) === "PENDING",
      ),
      PAST: plans.filter(
        (plan) => planView({ ...plan, startAt: plan.proposedStartAt }, now) === "PAST",
      ),
    }),
    [plans, now],
  );
  const visible = grouped[view];
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const filteredMatches = useMemo(
    () =>
      matches.filter((match) =>
        match.otherUser.displayName
          .toLocaleLowerCase()
          .includes(matchQuery.trim().toLocaleLowerCase()),
      ),
    [matches, matchQuery],
  );

  const openPlaceSearch = () => {
    setSelectedMatchId(null);
    setMatchQuery("");
    setMatchPickerOpen(true);
  };

  if (matchPickerOpen) {
    return (
      <Modal
        visible
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setMatchPickerOpen(false)}
      >
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
          <Header showBack onLeftPress={() => setMatchPickerOpen(false)} />
          <View style={[styles.pickerContent, { paddingHorizontal: responsive.screenPadding }]}>
            <Text variant="titleSm">Meet with</Text>
            <Text variant="caption" color="textSubdued">
              Who would you like to plan a meetup with?
            </Text>
            {matches.length > 0 ? (
              <>
                <Input
                  value={matchQuery}
                  onChangeText={setMatchQuery}
                  placeholder="Search your matches"
                  accessibilityLabel="Search your matches"
                  leftIcon={<Icon name="search" size={18} color={palette.textMuted} />}
                />
                <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
                  {filteredMatches.map((match) => (
                    <Pressable
                      key={match.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedMatchId === match.id }}
                      accessibilityLabel={`Meet with ${match.otherUser.displayName}`}
                      onPress={() => setSelectedMatchId(match.id)}
                      style={({ pressed }) => [styles.matchRow, pressed ? styles.pressed : null]}
                    >
                      <Avatar
                        uri={match.otherUser.photos.find((photo) => photo.isPrimary)?.url ?? match.otherUser.photos[0]?.url}
                        initials={match.otherUser.displayName}
                        size={44}
                      />
                      <View style={styles.flex}>
                        <Text variant="bodyStrong" numberOfLines={1}>{match.otherUser.displayName}</Text>
                        <Text variant="caption" color="textSubdued" numberOfLines={1}>
                          {match.otherUser.location.city || "Your connection"}
                        </Text>
                      </View>
                      <View style={[styles.radio, selectedMatchId === match.id ? styles.radioSelected : null]}>
                        {selectedMatchId === match.id ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  ))}
                  {filteredMatches.length === 0 ? (
                    <Text variant="caption" color="textSubdued">No matches found for that search.</Text>
                  ) : null}
                </ScrollView>
                <Button
                  label="Continue"
                  fullWidth
                  disabled={!selectedMatchId}
                  onPress={() => {
                    if (!selectedMatchId) return;
                    setMatchPickerOpen(false);
                    router.push({ pathname: "/(app)/date-plan/new", params: { matchId: selectedMatchId } });
                  }}
                />
              </>
            ) : (
              <View style={styles.pickerEmpty}>
                <EmptyState
                  title="No connections yet"
                  body="Connect with someone to make a meetup plan."
                  actionLabel="Go to Connect"
                  onAction={() => {
                    setMatchPickerOpen(false);
                    router.push("/(app)/(tabs)/connections");
                  }}
                />
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        <TabHeader
          title="Meetups"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Plan a meetup"
              onPress={openPlaceSearch}
              style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
            >
              <Icon name="plus" size={17} color={palette.brandStrong} />
              <Text variant="bodyStrong" color="brandStrong">Plan</Text>
            </Pressable>
          }
        />
        <View style={[styles.segmentWrap, { paddingHorizontal: responsive.screenPadding }]}>
          <SegmentedControl
            variant="underline"
            value={view}
            onChange={setView}
            accessibilityLabel="Meetup sections"
            options={[
              { value: "UPCOMING", label: "Upcoming", count: grouped.UPCOMING.length },
              { value: "PENDING", label: "Pending", count: grouped.PENDING.length },
              { value: "PAST", label: "Past", count: grouped.PAST.length },
            ]}
          />
        </View>
        <ScrollView
          style={{ marginBottom: Math.max(bottomNavigationInset - spacing.md, 0) }}
          contentContainerStyle={[styles.content, { paddingHorizontal: responsive.screenPadding }]}
          showsVerticalScrollIndicator={false}
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
          {eventsEnabled ? <Pressable accessibilityRole="button" accessibilityLabel="Explore events nearby"
            onPress={() => router.push("/(app)/events")}>
            <Card style={styles.refreshError}>
              <Icon name="calendar" size={22} color={palette.brandStrong} />
              <View style={styles.errorCopy}>
                <Text variant="bodyStrong">Events around you</Text>
                <Text variant="caption" color="textSubdued">Find something to enjoy with a match</Text>
              </View>
              <Icon name="chevronRight" size={18} color={palette.textMuted} />
            </Card>
          </Pressable> : null}
          {error && plans.length > 0 ? (
            <Card style={styles.refreshError}>
              <View style={styles.errorCopy}>
                <Text variant="bodyStrong">Plans may be out of date</Text>
                <Text variant="caption" color="textSubdued">
                  {error}
                </Text>
              </View>
              <Button
                label="Retry"
                variant="secondary"
                size="sm"
                onPress={() => void load("refresh")}
              />
            </Card>
          ) : null}
          {loading && plans.length === 0 ? (
            <Text variant="body" color="textSubdued">
              Loading plans…
            </Text>
          ) : error && plans.length === 0 ? (
            <EmptyState
              title="Meetups didn’t load"
              body={error}
              actionLabel="Try again"
              onAction={() => void load("initial")}
            />
          ) : visible.length > 0 ? (
            <View style={styles.planList}>
              <Text variant="bodyStrong">{view === "UPCOMING" ? "Upcoming" : view === "PENDING" ? "Pending" : "Past"}</Text>
              {visible.map((plan) => {
                const match = matchById.get(plan.matchId);
                return (
                  <DatePlanCard
                    key={plan.id}
                    plan={plan}
                    now={now}
                    viewerUserId={user?.id}
                    personName={names[plan.matchId]}
                    personPhoto={
                      match?.otherUser.photos.find((photo) => photo.isPrimary)?.url ??
                      match?.otherUser.photos[0]?.url
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/date-plan/[datePlanId]",
                        params: { datePlanId: plan.id },
                      })
                    }
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="calendar" size={28} color={palette.brandStrong} />
              </View>
              <Text variant="titleSm">
                {view === "UPCOMING"
                  ? "No upcoming meetups"
                  : view === "PENDING"
                    ? "Nothing waiting"
                    : "No past meetups"}
              </Text>
              <Text variant="body" color="textSubdued" align="center">
                {view === "UPCOMING"
                  ? "Pick a place and time with someone you’ve connected with."
                  : view === "PENDING"
                    ? "Plans awaiting a reply will appear here."
                    : "Your completed meetups will appear here."}
              </Text>
              {view === "UPCOMING" ? (
                <Button label="Plan a meetup" onPress={openPlaceSearch} />
              ) : null}
              {view === "UPCOMING" && matches.length === 0 ? (
                <Button
                  label="Explore connections"
                  variant="ghost"
                  onPress={() => router.push("/(app)/(tabs)/connections")}
                />
              ) : null}
            </View>
          )}
        </ScrollView>

      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  addButton: {
    minHeight: controlSize.minimumTouchTarget,
    minWidth: controlSize.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  segmentWrap: { paddingBottom: spacing.xs },
  content: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  planList: { gap: spacing.xs },
  emptyState: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
  },
  refreshError: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  errorCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  pickerContent: { flex: 1, gap: spacing.sm, paddingBottom: spacing.lg },
  pickerList: { flex: 1, marginTop: spacing.sm },
  pickerEmpty: { flex: 1, justifyContent: "center" },
  matchRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.textMuted, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: palette.brandStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.brandStrong },
}));
