import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { datePlansApi } from "../../api/endpoints/datePlans";
import { matchesApi } from "../../api/endpoints/matches";
import { useAuth } from "../../auth";
import { SegmentedControl } from "../../components/dating";
import { VenueArtwork } from "../../components/datePlans/VenueArtwork";
import { Header } from "../../components/layout/Header";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Button, ButtonRow } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Chip } from "../../components/ui/Chip";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useLocalization } from "../../localization/LocalizationContext";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { controlSize, layout, radius, spacing } from "../../theme/spacing";
import type {
  DatePlanDto,
  DateSafetyStatus,
  VenueCategory,
  VenueLocationMode,
  VenueSuggestion,
} from "../../types/datePlan";
import { formatDateTime } from "../../utils/format";
import { DateTimeFields } from "./DateTimeFields";
import {
  buildGoogleMapsPlaceUrl,
  buildGoogleMapsSearchUrl,
  createQuickMeetupDateTime,
  firstRouteParam,
  formatLocalDateValue,
  formatLocalTimeValue,
  isSameMinute,
  parseLocalDateTime,
  type QuickMeetupTime,
} from "./datePlanLogic";

import { canCancelPlan, canRespondToPlan, planNeedsEventReview, planStatusLabel } from "./planPresentation";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useRealtime } from "../../realtime/RealtimeProvider";

const CATEGORIES: Array<{ value: VenueCategory; label: string; query: string }> = [
  { value: "CAFE", label: "Café", query: "cafes" },
  { value: "RESTAURANT", label: "Food", query: "restaurants" },
  { value: "ACTIVITY", label: "Activity", query: "fun activities" },
];

export const DatePlanDetailScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const { t } = useLocalization();
  const realtime = useRealtime();
  const router = useRouter();
  const goBack = useSafeBack("/(app)/date-plan");
  const now = useCurrentTime();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ datePlanId?: string | string[] }>();
  const datePlanId = firstRouteParam(params.datePlanId);
  const [plan, setPlan] = useState<DatePlanDto | null>(null);
  const [personName, setPersonName] = useState("your match");
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const [placeEditorOpen, setPlaceEditorOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [venueCategory, setVenueCategory] = useState<VenueCategory>("CAFE");
  const [venueQuery, setVenueQuery] = useState("");
  const [venueLocationMode, setVenueLocationMode] = useState<VenueLocationMode>("MIDPOINT");
  const [venueArea, setVenueArea] = useState("");
  const [venueAreaDraft, setVenueAreaDraft] = useState("");
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [venueSuggestions, setVenueSuggestions] = useState<VenueSuggestion[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const loadSequence = useRef(0);
  const mutationLock = useRef(false);
  const active = useRef(false);

  const loadVenues = useCallback(
    async (
      matchId: string,
      category = venueCategory,
      query = venueQuery,
      locationMode = venueLocationMode,
      area = venueArea,
    ) => {
      setLoadingVenues(true);
      try {
        const response = await datePlansApi.venueSuggestions(matchId, {
          category,
          query: query.trim() || undefined,
          locationMode,
          area: locationMode === "AREA" ? area.trim() : undefined,
        });
        setVenueSuggestions(response.items);
      } catch {
        setVenueSuggestions([]);
        toast.show("Places could not be loaded. Google Maps is still available.", "error");
      } finally {
        setLoadingVenues(false);
      }
    },
    [toast, venueArea, venueCategory, venueLocationMode, venueQuery],
  );

  const load = useCallback(async () => {
    if (!active.current) return;
    const requestId = ++loadSequence.current;
    if (!datePlanId) {
      setPlan(null);
      setLoading(false);
      setError("This meetup link is incomplete or no longer available.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await datePlansApi.get(datePlanId);
      if (requestId !== loadSequence.current) return;
      setPlan(next);
      setLoading(false);
      void matchesApi
        .get(next.matchId)
        .then((match) => {
          if (requestId === loadSequence.current) {
            setPersonName(match.otherUser.displayName);
            setPersonPhoto(
              match.otherUser.photos.find((photo) => photo.isPrimary)?.url ??
                match.otherUser.photos[0]?.url ??
                null,
            );
          }
        })
        .catch(() => undefined);
    } catch {
      if (requestId !== loadSequence.current) return;
      setPlan(null);
      setLoading(false);
      setError("Check your connection and try loading this meetup again.");
    }
  }, [datePlanId]);

  useFocusEffect(useCallback(() => {
    active.current = AppState.currentState === "active";
    if (active.current) void load();
    const invalidate = () => {
      loadSequence.current += 1;
      setPlan(null); setPersonPhoto(null); setPersonName("your match");
      setTimeEditorOpen(false); setPlaceEditorOpen(false); setSafetyOpen(false);
    };
    const unsubscribe = realtime.onNotification(({ notification }) => {
      if (active.current && notification.data?.route === "event-plan-change" && notification.data.datePlanId === datePlanId) {
        invalidate(); void load();
      }
    });
    const listener = AppState.addEventListener("change", state => {
      active.current = state === "active";
      if (active.current) void load();
      else invalidate();
    });
    return () => {
      active.current = false; listener.remove(); unsubscribe(); invalidate();
    };
  }, [load, realtime, datePlanId]));

  const mutate = async (action: () => Promise<DatePlanDto>, success: string): Promise<boolean> => {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    const requestId = loadSequence.current;
    setBusy(true);
    try {
      const updated = await action();
      if (requestId !== loadSequence.current || !active.current) return false;
      setPlan(updated);
      toast.show(success, "success");
      return true;
    } catch {
      toast.show("That meetup update could not be saved. Try again.", "error");
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };

  const openTimeEditor = () => {
    if (!plan) return;
    const current = new Date(plan.proposedStartAt);
    setRescheduleDate(formatLocalDateValue(current));
    setRescheduleTime(formatLocalTimeValue(current));
    setRescheduleError(null);
    setPlaceEditorOpen(false);
    setTimeEditorOpen(true);
  };

  const rescheduleResult = useMemo(
    () => parseLocalDateTime(rescheduleDate, rescheduleTime),
    [rescheduleDate, rescheduleTime],
  );

  const chooseQuickTime = (value: QuickMeetupTime) => {
    const next = createQuickMeetupDateTime(value);
    setRescheduleDate(next.date);
    setRescheduleTime(next.time);
    setRescheduleError(null);
  };

  const proposeNewTime = async () => {
    if (!plan || !rescheduleResult.iso) {
      setRescheduleError(rescheduleResult.error);
      return;
    }
    if (isSameMinute(plan.proposedStartAt, rescheduleResult.iso)) {
      setRescheduleError("Choose a different time before sending.");
      return;
    }
    const saved = await mutate(
      () => datePlansApi.counter(plan.id, { proposedStartAt: rescheduleResult.iso as string }),
      "New time suggested.",
    );
    if (saved) setTimeEditorOpen(false);
  };

  const openPlaceEditor = () => {
    if (!plan) return;
    setTimeEditorOpen(false);
    setPlaceEditorOpen(true);
  };

  useEffect(() => {
    if (!placeEditorOpen || !plan) return;
    const timer = setTimeout(
      () => {
        void loadVenues(plan.matchId, venueCategory, venueQuery, venueLocationMode, venueArea);
      },
      venueQuery.trim() ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [loadVenues, placeEditorOpen, plan, venueArea, venueCategory, venueLocationMode, venueQuery]);

  const suggestVenue = async (venue: VenueSuggestion) => {
    if (!plan) return;
    const saved = await mutate(
      () =>
        datePlansApi.counter(plan.id, {
          reviewedVenueId: venue.id,
          activityType: venue.category === "OTHER" ? plan.activityType : venue.category,
        }),
      `${venue.name} suggested.`,
    );
    if (saved) setPlaceEditorOpen(false);
  };

  const openMaps = async (name: string, address: string) => {
    try {
      await Linking.openURL(buildGoogleMapsPlaceUrl(name, address));
    } catch {
      toast.show("Google Maps could not be opened on this device.", "error");
    }
  };

  const searchMaps = async () => {
    if (!plan) return;
    try {
      await Linking.openURL(
        buildGoogleMapsSearchUrl(
          venueQuery || CATEGORIES.find((item) => item.value === venueCategory)!.query,
          venueLocationMode === "AREA" ? venueArea : plan.publicLocality,
        ),
      );
    } catch {
      toast.show("Google Maps could not be opened on this device.", "error");
    }
  };

  const shareWithTrustedContact = async () => {
    if (!plan) return;
    const venue =
      [plan.venueName, plan.venueAddress].filter(Boolean).join(", ") || plan.publicLocality;
    try {
      await Share.share({
        title: `Yariva meetup · ${plan.title}`,
        message: [
          `I have a Yariva meetup with ${personName}.`,
          `${formatDateTime(plan.proposedStartAt)} · ${venue}`,
          "Please check in with me around this time.",
        ].join("\n"),
      });
    } catch {
      toast.show("This device could not open the share sheet.", "error");
    }
  };

  const checkIn = (status: DateSafetyStatus) => {
    if (!plan) return;
    void mutate(
      () => datePlansApi.checkIn(plan.id, status),
      status === "NEED_HELP" ? "Your safety signal was recorded." : "Check-in saved.",
    );
  };

  if (!plan) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
        <Header title="Meetup" showBack onLeftPress={goBack} />
        <View style={styles.loading}>
          {loading ? <ActivityIndicator color={palette.brand} /> : null}
          <Text variant="body" color="textSubdued" accessibilityLiveRegion="polite">
            {error ?? "Loading meetup…"}
          </Text>
          {error ? (
            <Button label="Try again" variant="secondary" onPress={() => void load()} />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const myAccepted = user?.id
    ? plan.responses.some(
        (response) =>
          response.userId === user.id &&
          response.proposalVersion === plan.proposalVersion &&
          response.response === "ACCEPTED",
      )
    : false;
  const schedule = { ...plan, startAt: plan.proposedStartAt };
  const actionable = canRespondToPlan(schedule, now);
  const isCreator = user?.id === plan.createdByUserId;

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
      <Header title="Meetup" showBack onLeftPress={goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {plan.venuePhotoUrl ? (
          <View style={styles.venueFeature}>
            <VenueArtwork
              photoUrl={plan.venuePhotoUrl}
              category={plan.activityType}
              style={styles.venueHero}
            />
          </View>
        ) : null}
        <View style={styles.titleBlock}>
          <View style={styles.eyebrowRow}>
            <Avatar uri={personPhoto} initials={personName} size={40} />
            <View style={styles.flex}>
              <Text variant="caption" color="textSubdued" numberOfLines={1}>
                Meetup with {personName}
              </Text>
              <Text variant="titleSm" numberOfLines={2}>
                {plan.title}
              </Text>
            </View>
            <Badge
              label={planStatusLabel({ ...plan, startAt: plan.proposedStartAt }, now, t)}
              tone={
                planNeedsEventReview(schedule, now) ? "warning" : plan.status === "ACCEPTED" || plan.status === "COMPLETED"
                  ? "success"
                  : plan.status === "CANCELLED" || plan.status === "DECLINED"
                    ? "neutral"
                    : "warning"
              }
            />
          </View>
        </View>

        <Card padded={false} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.iconTile}>
              <Icon name="calendar" size={17} color={palette.brandStrong} />
            </View>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {formatDateTime(plan.proposedStartAt)}
            </Text>
            <Text variant="caption" color="textSubdued">
              {plan.durationMinutes} min
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${plan.venueName ?? plan.publicLocality} in Google Maps`}
            onPress={() =>
              void openMaps(
                plan.venueName ?? plan.publicLocality,
                plan.venueAddress ?? plan.publicLocality,
              )
            }
            style={({ pressed }) => [
              styles.summaryRow,
              styles.summaryDivider,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <View style={styles.iconTile}>
              <Icon name="location" size={17} color={palette.brandStrong} filled />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {plan.venueName ?? plan.publicLocality}
              </Text>
              <Text variant="caption" color="textSubdued" numberOfLines={1}>
                {plan.venueAddress ?? plan.publicLocality}
              </Text>
            </View>
            <Icon name="chevronRight" size={17} color={palette.textMuted} />
          </Pressable>
        </Card>

        {plan.eventChanged || plan.eventUnavailable ? (
          <Card>
            <Text variant="bodyStrong">{t(plan.eventUnavailable ? "events.plan.unavailable" : "events.plan.changed")}</Text>
            <Text variant="body" color="textSubdued">
              {t("events.plan.snapshot.hint")}
            </Text>
            {plan.eventId ? <Button label={t("events.review.latest")} variant="secondary" onPress={() => router.push({ pathname: "/(app)/events/[eventId]", params: { eventId: plan.eventId! } })} /> : null}
          </Card>
        ) : null}

        {actionable ? (
          <View style={styles.actions}>
            {!myAccepted ? (
              <Button
                label="Accept meetup"
                fullWidth
                loading={busy}
                disabled={busy || plan.eventChanged || plan.eventUnavailable}
                onPress={() => void mutate(() => datePlansApi.accept(plan.id), "Meetup accepted.")}
              />
            ) : (
              <View style={styles.waitingRow}>
                <Icon name="clock" size={17} color={palette.brandStrong} />
                <Text variant="bodyStrong">Waiting for {personName}</Text>
              </View>
            )}

            <ButtonRow>
              {!plan.eventId ? <Button
                label={myAccepted ? "Change" : "Suggest change"}
                variant="secondary"
                disabled={busy}
                onPress={openTimeEditor}
              /> : null}
              <Button
                label={isCreator ? "Withdraw" : myAccepted ? "Withdraw" : "Decline"}
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  const cancel = isCreator;
                  Alert.alert(
                    cancel ? "Withdraw this meetup?" : "Decline this meetup?",
                    "You can keep chatting and plan something else.",
                    [
                      { text: "Keep it", style: "cancel" },
                      {
                        text: cancel ? "Withdraw" : "Decline",
                        style: "destructive",
                        onPress: () =>
                          void mutate(
                            () =>
                              cancel ? datePlansApi.cancel(plan.id) : datePlansApi.decline(plan.id),
                            cancel ? "Meetup withdrawn." : "Meetup declined.",
                          ),
                      },
                    ],
                  );
                }}
              />
            </ButtonRow>
          </View>
        ) : null}

        {plan.status === "ACCEPTED" ? (
          <Card padded={false} style={styles.safetyCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Safety tools"
              accessibilityState={{ expanded: safetyOpen }}
              onPress={() => setSafetyOpen((current) => !current)}
              style={({ pressed }) => [styles.safetyHeader, pressed ? styles.pressed : undefined]}
            >
              <Icon name="shield" size={18} color={palette.success} filled />
              <Text variant="bodyStrong" style={styles.flex}>
                Safety tools
              </Text>
              <Icon name="chevronDown" size={17} color={palette.textMuted} />
            </Pressable>
            {safetyOpen ? (
              <View style={styles.safetyBody}>
                <Button
                  label="Share with a contact"
                  variant="secondary"
                  fullWidth
                  onPress={() => void shareWithTrustedContact()}
                />
                <ButtonRow>
                  <Button
                    label="I arrived"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onPress={() => checkIn("ARRIVED")}
                  />
                  <Button
                    label="I’m okay"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onPress={() => checkIn("OKAY")}
                  />
                </ButtonRow>
                <ButtonRow>
                  <Button
                    label="I need help"
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onPress={() => checkIn("NEED_HELP")}
                  />
                  <Button
                    label="Call 112"
                    variant="danger"
                    size="sm"
                    onPress={() =>
                      Alert.alert(
                        "Call emergency services?",
                        "112 connects to emergency response in India.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Call 112",
                            style: "destructive",
                            onPress: () => void Linking.openURL("tel:112"),
                          },
                        ],
                      )
                    }
                  />
                </ButtonRow>
                <Button
                  label="Mark complete"
                  variant="ghost"
                  fullWidth
                  onPress={() =>
                    void mutate(() => datePlansApi.complete(plan.id), "Meetup completed.")
                  }
                />
              </View>
            ) : null}
          </Card>
        ) : null}

        {plan.status === "COMPLETED" && !plan.myPostDateResponseSubmitted ? (
          <Card style={styles.postDate}>
            <Text variant="titleSm">Meet again?</Text>
            <Text variant="caption" color="textSubdued">
              Revealed only if both say yes.
            </Text>
            <ButtonRow>
              <Button
                label="Yes"
                disabled={busy}
                onPress={() =>
                  void mutate(
                    () => datePlansApi.postDateResponse(plan.id, true),
                    "Answer saved privately.",
                  )
                }
              />
              <Button
                label="Not this time"
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void mutate(
                    () => datePlansApi.postDateResponse(plan.id, false),
                    "Answer saved privately.",
                  )
                }
              />
            </ButtonRow>
          </Card>
        ) : null}

        {plan.status === "COMPLETED" && plan.myPostDateResponseSubmitted ? (
          <Card style={styles.postDate}>
            <Text variant="bodyStrong">
              {plan.meetAgainOutcome === "MUTUAL"
                ? `It’s mutual—${personName} wants to meet again.`
                : "Your answer is saved privately."}
            </Text>
          </Card>
        ) : null}

        {canCancelPlan(schedule, now) ? (
          <Button
            label="Cancel meetup"
            variant="ghost"
            fullWidth
            disabled={busy}
            onPress={() =>
              Alert.alert("Cancel this meetup?", "Both people will be notified.", [
                { text: "Keep it", style: "cancel" },
                {
                  text: "Cancel meetup",
                  style: "destructive",
                  onPress: () =>
                    void mutate(() => datePlansApi.cancel(plan.id), "Meetup cancelled."),
                },
              ])
            }
          />
        ) : null}
      </ScrollView>

      <CenterDialog
        visible={actionable && (timeEditorOpen || placeEditorOpen)}
        onClose={() => {
          setTimeEditorOpen(false);
          setPlaceEditorOpen(false);
        }}
        accessibilityLabel="Change meetup"
      >
        <View style={styles.dialogContent}>
          <Text variant="titleSm">Change meetup</Text>
          <SegmentedControl
            variant="underline"
            value={timeEditorOpen ? "TIME" : "PLACE"}
            onChange={(value) => (value === "TIME" ? openTimeEditor() : openPlaceEditor())}
            accessibilityLabel="Change meetup section"
            options={[
              { value: "TIME", label: "Time" },
              { value: "PLACE", label: "Place" },
            ]}
          />

          {timeEditorOpen ? (
            <View style={styles.dialogSection}>
              <View style={styles.wrapRow}>
                <Chip label="Tonight" onPress={() => chooseQuickTime("TONIGHT")} />
                <Chip label="Tomorrow" onPress={() => chooseQuickTime("TOMORROW")} />
                <Chip label="Weekend" onPress={() => chooseQuickTime("WEEKEND")} />
              </View>
              <DateTimeFields
                date={rescheduleDate}
                time={rescheduleTime}
                onDateChange={setRescheduleDate}
                onTimeChange={setRescheduleTime}
                error={rescheduleError}
                disabled={busy}
              />
              <View style={styles.editorActions}>
                <Button
                  label="Close"
                  variant="ghost"
                  size="sm"
                  onPress={() => setTimeEditorOpen(false)}
                />
                <Button
                  label="Suggest time"
                  size="sm"
                  loading={busy}
                  onPress={() => void proposeNewTime()}
                />
              </View>
            </View>
          ) : null}

          {placeEditorOpen ? (
            <View style={styles.dialogSection}>
              <Input
                value={venueQuery}
                onChangeText={setVenueQuery}
                placeholder="Search cafes, restaurants, activities"
                returnKeyType="search"
                onSubmitEditing={() =>
                  void loadVenues(
                    plan.matchId,
                    venueCategory,
                    venueQuery,
                    venueLocationMode,
                    venueArea,
                  )
                }
                leftIcon={<Icon name="search" size={17} color={palette.textMuted} />}
                rightIcon={
                  loadingVenues ? (
                    <ActivityIndicator size="small" color={palette.brand} />
                  ) : undefined
                }
                accessibilityLabel="Search another place"
              />
              <SegmentedControl
                variant="underline"
                value={venueCategory}
                onChange={(value) => {
                  setVenueCategory(value);
                  setVenueQuery("");
                }}
                accessibilityLabel="Venue categories"
                options={CATEGORIES.map((item) => ({ value: item.value, label: item.label }))}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search location: ${venueLocationMode === "ME" ? "Near me" : venueLocationMode === "AREA" ? venueArea : "Halfway"}`}
                onPress={() => {
                  setVenueAreaDraft(venueArea);
                  setLocationEditorOpen((current) => !current);
                }}
                style={styles.locationControl}
              >
                <Icon name="location" size={16} color={palette.brandStrong} filled />
                <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  Top picks ·{" "}
                  {venueLocationMode === "ME"
                    ? "Near me"
                    : venueLocationMode === "AREA"
                      ? venueArea
                      : "Halfway"}
                </Text>
                <Icon name="chevronDown" size={17} color={palette.textSecondary} />
              </Pressable>
              {locationEditorOpen ? (
                <View style={styles.locationEditor}>
                  <View style={styles.wrapRow}>
                    <Chip
                      label="Halfway"
                      selected={venueLocationMode === "MIDPOINT"}
                      onPress={() => {
                        setVenueLocationMode("MIDPOINT");
                        setVenueArea("");
                        setLocationEditorOpen(false);
                      }}
                    />
                    <Chip
                      label="Near me"
                      selected={venueLocationMode === "ME"}
                      onPress={() => {
                        setVenueLocationMode("ME");
                        setVenueArea("");
                        setLocationEditorOpen(false);
                      }}
                    />
                  </View>
                  <Input
                    value={venueAreaDraft}
                    onChangeText={setVenueAreaDraft}
                    placeholder="Search an area"
                    returnKeyType="search"
                    accessibilityLabel="Area name"
                  />
                  <Button
                    label="Show places"
                    size="sm"
                    disabled={!venueAreaDraft.trim()}
                    onPress={() => {
                      setVenueArea(venueAreaDraft.trim());
                      setVenueLocationMode("AREA");
                      setLocationEditorOpen(false);
                    }}
                  />
                </View>
              ) : null}
              <ScrollView style={styles.venueResults} keyboardShouldPersistTaps="handled">
                {venueSuggestions.map((venue) => (
                  <Pressable
                    key={venue.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Suggest ${venue.name}`}
                    onPress={() => void suggestVenue(venue)}
                    style={styles.venueRow}
                  >
                    <VenueArtwork
                      photoUrl={venue.photoUrl}
                      category={venue.category}
                      style={styles.venueResultArtwork}
                    />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {venue.name}
                      </Text>
                      <View style={styles.venueMetadata}>
                        {venue.rating != null ? (
                          <>
                            <Icon name="star" size={13} color={palette.warning} filled />
                            <Text variant="captionStrong">{venue.rating.toFixed(1)}</Text>
                          </>
                        ) : null}
                        <Text
                          variant="caption"
                          color="textSubdued"
                          numberOfLines={1}
                          style={styles.flex}
                        >
                          {[
                            venue.distanceKm == null ? null : `${venue.distanceKm.toFixed(1)} km`,
                            venue.publicLocality,
                            venue.priceTier,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevronRight" size={18} color={palette.textSecondary} />
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.editorActions}>
                <Button
                  label="Close"
                  variant="ghost"
                  size="sm"
                  onPress={() => setPlaceEditorOpen(false)}
                />
                <Button
                  label="Google Maps"
                  variant="secondary"
                  size="sm"
                  onPress={() => void searchMaps()}
                />
              </View>
            </View>
          ) : null}
        </View>
      </CenterDialog>
    </SafeAreaView>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  content: {
    width: "100%",
    maxWidth: layout.formMaxWidth,
    alignSelf: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: layout.compactScreenPadding,
    paddingBottom: spacing.hero,
  },
  titleBlock: { alignItems: "flex-start" },
  venueFeature: {
    overflow: "hidden",
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  venueHero: {
    width: "100%",
    height: 116,
    borderRadius: 0,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryCard: { overflow: "hidden", borderColor: palette.border },
  summaryRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryDivider: { borderTopWidth: 1, borderTopColor: palette.divider },
  iconTile: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
  actions: { gap: spacing.sm, paddingTop: spacing.xs },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editorActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  venueResultArtwork: { width: 44, height: 44 },
  venueMetadata: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  venueResults: { maxHeight: 220 },
  locationControl: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: palette.surfaceTint,
  },
  locationEditor: { gap: spacing.sm },
  dialogContent: { gap: spacing.md },
  dialogSection: { gap: spacing.md },
  safetyCard: { overflow: "hidden", borderColor: palette.border },
  safetyHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  safetyBody: {
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.divider,
  },
  postDate: { gap: spacing.sm, borderColor: palette.border, backgroundColor: palette.surface },
}));
