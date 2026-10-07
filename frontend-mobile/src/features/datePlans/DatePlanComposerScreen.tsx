import * as Localization from "expo-localization";
import { uuid } from "expo-modules-core";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { datePlansApi } from "../../api/endpoints/datePlans";
import { duoPlansApi } from "../../api/endpoints/duoPlans";
import { matchesApi } from "../../api/endpoints/matches";
import { Header } from "../../components/layout/Header";
import { VenueArtwork } from "../../components/datePlans/VenueArtwork";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Chip } from "../../components/ui/Chip";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { controlSize, layout, radius, spacing } from "../../theme/spacing";
import type { VenueCategory, VenueLocationMode, VenueSuggestion } from "../../types/datePlan";
import { formatDateTime } from "../../utils/format";
import { DateTimeFields } from "./DateTimeFields";
import {
  buildGoogleMapsPlaceUrl,
  buildGoogleMapsSearchUrl,
  createInitialPlanDateTime,
  createQuickMeetupDateTime,
  firstRouteParam,
  formatLocalDateValue,
  parseLocalDateTime,
} from "./datePlanLogic";

const CATEGORIES: Array<{ value: VenueCategory; label: string; search: string }> = [
  { value: "CAFE", label: "Café", search: "cafes" },
  { value: "RESTAURANT", label: "Food", search: "restaurants" },
  { value: "ACTIVITY", label: "Things to do", search: "fun activities" },
];

const STEP_TITLES = ["Plan a meetup", "Choose a place", "Date & time", "Review your plan"] as const;

export const DatePlanComposerScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/date-plans");
  const toast = useToast();
  const params = useLocalSearchParams<{
    matchId?: string | string[];
    conversationId?: string;
    counterPlanId?: string;
    expectedVersion?: string;
  }>();
  const matchId = firstRouteParam(params.matchId);
  const conversationId = params.conversationId;
  const hasSubject = Boolean(matchId || conversationId);
  const duoRequestId = useRef(uuid.v4());
  const initialTiming = useMemo(() => createInitialPlanDateTime(), []);
  const timezone = useMemo(() => Localization.getCalendars()[0]?.timeZone ?? "Asia/Kolkata", []);
  const [personName, setPersonName] = useState("your match");
  const [step, setStep] = useState(0);
  const [locality, setLocality] = useState("Hyderabad");
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const dateChoices = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return { value: formatLocalDateValue(date), day: date.toLocaleDateString(undefined, { weekday: "short" }), number: date.getDate() };
  }), []);
  const tomorrow = useMemo(() => createQuickMeetupDateTime("TOMORROW"), []);
  const [dateInput, setDateInput] = useState(tomorrow.date || initialTiming.date);
  const [timeInput, setTimeInput] = useState(tomorrow.time || initialTiming.time);
  const [category, setCategory] = useState<VenueCategory>("CAFE");
  const [searchInput, setSearchInput] = useState("");
  const [locationMode, setLocationMode] = useState<VenueLocationMode>("MIDPOINT");
  const [area, setArea] = useState("");
  const [areaDraft, setAreaDraft] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [venues, setVenues] = useState<VenueSuggestion[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueSuggestion | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [usingManual, setUsingManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const requestSequence = useRef(0);
  const sendLock = useRef(false);
  const idempotencyKey = useRef(`meetup-${matchId ?? "unknown"}-${Date.now().toString(36)}`);

  const categoryConfig = CATEGORIES.find((item) => item.value === category)!;
  const proposedTime = useMemo(
    () => parseLocalDateTime(dateInput, timeInput),
    [dateInput, timeInput],
  );
  const calendarMonth = useMemo(() => {
    const date = new Date(`${dateInput}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? "Choose a day"
      : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [dateInput]);

  const loadVenues = useCallback(
    async (
      nextCategory: VenueCategory,
      nextQuery: string,
      nextLocationMode: VenueLocationMode,
      nextArea: string,
    ) => {
      if (!matchId && !conversationId) return;
      const requestId = ++requestSequence.current;
      setLoadingVenues(true);
      setSearchError(null);
      try {
        const query = {
          category: nextCategory,
          query: nextQuery.trim() || undefined,
          locationMode: nextLocationMode,
          area: nextLocationMode === "AREA" ? nextArea.trim() : undefined,
        };
        const response = conversationId
          ? await duoPlansApi.venues(conversationId, query)
          : await datePlansApi.venueSuggestions(matchId!, query);
        if (requestId !== requestSequence.current) return;
        setVenues(response.items);
        setSelectedVenue(
          (current) => response.items.find((venue) => venue.id === current?.id) ?? null,
        );
      } catch {
        if (requestId === requestSequence.current) {
          setVenues([]);
          setSelectedVenue(null);
          setSearchError("Places unavailable");
        }
      } finally {
        if (requestId === requestSequence.current) setLoadingVenues(false);
      }
    },
    [matchId, conversationId],
  );

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    void matchesApi
      .get(matchId)
      .then((match) => {
        if (!active) return;
        setPersonName(match.otherUser.displayName);
        if (match.otherUser.location.city) setLocality(match.otherUser.location.city);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      requestSequence.current += 1;
    };
  }, [matchId]);

  useEffect(() => {
    if (!hasSubject) return;
    const timer = setTimeout(
      () => {
        void loadVenues(category, searchInput, locationMode, area);
      },
      searchInput.trim() ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [area, category, loadVenues, locationMode, hasSubject, searchInput]);

  const chooseCategory = (value: VenueCategory) => {
    setCategory(value);
    setSearchInput("");
    setManualOpen(false);
    setUsingManual(false);
    setSelectedVenue(null);
  };

  const openMapsSearch = async () => {
    try {
      await Linking.openURL(
        buildGoogleMapsSearchUrl(
          searchInput.trim() || categoryConfig.search,
          locationMode === "AREA" ? area : locality,
        ),
      );
    } catch {
      toast.show("Google Maps could not be opened on this device.", "error");
    }
  };

  const openVenueInMaps = async (venue: VenueSuggestion) => {
    try {
      await Linking.openURL(buildGoogleMapsPlaceUrl(venue.name, venue.address));
    } catch {
      toast.show("Google Maps could not be opened on this device.", "error");
    }
  };

  const openSelectedInMaps = async () => {
    if (selectedVenue) {
      await openVenueInMaps(selectedVenue);
      return;
    }
    if (usingManual && manualName.trim() && manualAddress.trim()) {
      try {
        await Linking.openURL(buildGoogleMapsPlaceUrl(manualName.trim(), manualAddress.trim()));
      } catch {
        toast.show("Google Maps could not be opened on this device.", "error");
      }
      return;
    }
    await openMapsSearch();
  };

  const send = async () => {
    if (sendLock.current || sending || !hasSubject) return;
    if (!proposedTime.iso) {
      setSendError(proposedTime.error);
      return;
    }
    if (!selectedVenue && (!usingManual || !manualName.trim() || !manualAddress.trim())) {
      setSendError("Choose a place or add one first.");
      return;
    }
    const venueName = selectedVenue?.name ?? manualName.trim();
    const venueAddress = selectedVenue?.address ?? manualAddress.trim();
    const venueLocality = selectedVenue?.publicLocality ?? (locality.trim() || "Hyderabad");

    sendLock.current = true;
    setSending(true);
    setSendError(null);
    try {
      if (conversationId) {
        const proposal = {
          requestId: duoRequestId.current,
          activity: `${categoryConfig.label} meetup`,
          venueName,
          publicLocality: venueLocality,
          startAt: proposedTime.iso,
        };
        if (params.counterPlanId)
          await duoPlansApi.counter(params.counterPlanId, {
            ...proposal,
            expectedVersion: Number(params.expectedVersion),
          });
        else await duoPlansApi.create(conversationId, proposal);
        router.replace({
          pathname: "/(app)/duo-plans/[conversationId]",
          params: { conversationId },
        });
        return;
      }
      const plan = await datePlansApi.create(matchId!, {
        reviewedVenueId: selectedVenue?.id ?? null,
        title: `${categoryConfig.label} meetup`,
        description: `Casual ${categoryConfig.label.toLocaleLowerCase()} meetup at ${venueName}.`,
        activityType: category,
        proposedStartAt: proposedTime.iso,
        durationMinutes: category === "ACTIVITY" ? 120 : 90,
        timezone,
        publicLocality: venueLocality,
        venueName: selectedVenue ? null : venueName,
        venueAddress: selectedVenue ? null : venueAddress,
        idempotencyKey: idempotencyKey.current,
      });
      router.replace({
        pathname: "/(app)/date-plan/[datePlanId]",
        params: { datePlanId: plan.id },
      });
    } catch {
      setSendError("This meetup was not sent. Your choices are still here—try again.");
      toast.show("Meetup not sent.", "error");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  const continuePlan = () => {
    setSendError(null);
    if (
      step === 1 &&
      !selectedVenue &&
      (!usingManual || !manualName.trim() || !manualAddress.trim())
    ) {
      setSendError("Choose a place or add one first.");
      return;
    }
    if (step === 2 && !proposedTime.iso) {
      setSendError(proposedTime.error);
      return;
    }
    if (step === 3) {
      void send();
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
        <Header
          title=""
          showBack
          onLeftPress={() => (step > 0 ? setStep(step - 1) : goBack())}
        />
        <View
          style={styles.progressWrap}
          accessibilityLabel={`Step ${step + 1} of 4: ${STEP_TITLES[step]}`}
        >
          <View style={styles.progressBars}>
            {STEP_TITLES.map((title, index) => (
              <View
                key={title}
                style={[styles.progressBar, index <= step ? styles.progressBarActive : null]}
              />
            ))}
          </View>
          <Text variant="titleSm" accessibilityRole="header">
            {params.counterPlanId && step === 0 ? "Suggest a change" : STEP_TITLES[step]}
          </Text>
          <Text variant="caption" color="textSubdued">
            Step {step + 1} of 4
          </Text>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {step === 0 ? (
            <View style={styles.section}>
              <Text variant="titleSm">What would you like to do?</Text>
              <Text variant="caption" color="textSubdued">
                A simple plan with {conversationId ? "your group" : personName}.
              </Text>
              {CATEGORIES.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category === item.value }}
                  onPress={() => chooseCategory(item.value)}
                  style={({ pressed }) => [
                    styles.activityRow,
                    category === item.value ? styles.venueRowSelected : null,
                    pressed ? styles.venueRowPressed : null,
                  ]}
                >
                  <View style={styles.venueIcon}>
                    <Icon
                      name={
                        item.value === "CAFE"
                          ? "cafe"
                          : item.value === "RESTAURANT"
                            ? "restaurant"
                            : "sparkle"
                      }
                      size={20}
                      color={palette.brandStrong}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{item.label}</Text>
                    <Text variant="caption" color="textSubdued">
                      {item.value === "CAFE"
                        ? "Coffee and conversation"
                        : item.value === "RESTAURANT"
                          ? "A meal together"
                          : "Walks, museums and more"}
                    </Text>
                  </View>
                  <View style={[styles.radio, category === item.value ? styles.radioSelected : null]}>
                    {category === item.value ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {step === 1 ? (
            <>
              <View style={styles.section}>
                <Text variant="titleSm">Where would you like to meet?</Text>
                <Input
                  value={searchInput}
                  onChangeText={setSearchInput}
                  placeholder="Search places"
                  returnKeyType="search"
                  onSubmitEditing={() => void loadVenues(category, searchInput, locationMode, area)}
                  leftIcon={<Icon name="search" size={19} color={palette.textMuted} />}
                  rightIcon={
                    loadingVenues ? (
                      <ActivityIndicator size="small" color={palette.brand} />
                    ) : undefined
                  }
                  accessibilityLabel="Search meetup places"
                />
                <View style={styles.locationChoices}>
                  <Chip label="Near me" selected={locationMode === "ME"} onPress={() => { setLocationMode("ME"); setArea(""); }} />
                  <Chip label={conversationId ? "Near group" : "Midpoint"} selected={locationMode === "MIDPOINT"} onPress={() => { setLocationMode("MIDPOINT"); setArea(""); }} />
                  <Chip label={locationMode === "AREA" && area ? area : "Choose area"} selected={locationMode === "AREA"} onPress={() => { setAreaDraft(area); setLocationOpen(true); }} />
                </View>
              </View>

              {searchError ? (
                <Text variant="caption" color="error" accessibilityRole="alert">
                  {searchError}
                </Text>
              ) : null}

              {venues.length > 0 ? (
                <View style={styles.venueList}>
                  <Text variant="fieldLabel" color="textSubdued" style={styles.venueListLabel}>
                    SUGGESTED PLACES
                  </Text>
                  {venues.map((venue) => {
                    const selected = selectedVenue?.id === venue.id && !usingManual;
                    const details = [
                      venue.distanceKm == null ? null : `${venue.distanceKm.toFixed(1)} km`,
                      venue.priceTier,
                      venue.availability === "OPEN" ? "Open" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <Pressable
                        key={venue.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${venue.name}, ${details}`}
                        onPress={() => {
                          setSelectedVenue(venue);
                          setUsingManual(false);
                          setSendError(null);
                        }}
                        style={({ pressed }) => [
                          styles.venueRow,
                          selected ? styles.venueRowSelected : undefined,
                          pressed ? styles.venueRowPressed : undefined,
                        ]}
                      >
                        <VenueArtwork photoUrl={venue.photoUrl} category={venue.category} style={styles.venueArtwork} />
                        <View style={styles.flex}>
                          <Text variant="bodyStrong" numberOfLines={1}>
                            {venue.name}
                          </Text>
                          <Text variant="caption" color="textSubdued" numberOfLines={1}>
                            {venue.category === "CAFE" ? "Café" : venue.category === "RESTAURANT" ? "Restaurant" : "Activity"} · {venue.publicLocality}
                          </Text>
                          <View style={styles.metadataRow}>
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
                              {details}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                          {selected ? <View style={styles.radioDot} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {venues.length === 0 && !loadingVenues && !searchError ? (
                <Text variant="caption" color="textSubdued">
                  No places found here. Try another area or add a place.
                </Text>
              ) : null}

              {usingManual ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit added place"
                  onPress={() => setManualOpen(true)}
                  style={styles.manualSelection}
                >
                  <Icon name="location" size={19} color={palette.brandStrong} filled />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {manualName}
                    </Text>
                    <Text variant="caption" color="textSubdued" numberOfLines={1}>
                      {manualAddress}
                    </Text>
                  </View>
                  <Icon name="edit" size={17} color={palette.textSecondary} />
                </Pressable>
              ) : null}

              <View style={styles.secondaryActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View in Maps"
                  onPress={() => void openSelectedInMaps()}
                  style={({ pressed }) => [
                    styles.textAction,
                    pressed ? styles.venueRowPressed : null,
                  ]}
                >
                  <Icon name="globe" size={16} color={palette.brandStrong} />
                  <Text variant="captionStrong" color="textPrimary">
                    View in Maps
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a place"
                  onPress={() => setManualOpen(true)}
                  style={({ pressed }) => [
                    styles.textAction,
                    pressed ? styles.venueRowPressed : null,
                  ]}
                >
                  <Icon name="plus" size={16} color={palette.brandStrong} />
                  <Text variant="captionStrong" color="textPrimary">
                    Add a place
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <View style={styles.section}>
              <Text variant="bodyStrong">Choose a day</Text>
              <View style={styles.dateCard}>
                <Text variant="bodyStrong">{calendarMonth}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
                  {dateChoices.map((day) => (
                    <Pressable key={day.value} accessibilityRole="radio" accessibilityState={{ selected: dateInput === day.value }} accessibilityLabel={`${day.day} ${day.number}`} onPress={() => setDateInput(day.value)} style={[styles.dayChoice, dateInput === day.value ? styles.dayChoiceSelected : null]}>
                      <Text variant="caption" color={dateInput === day.value ? "textOnBrand" : "textSubdued"}>{day.day}</Text>
                      <Text variant="bodyStrong" color={dateInput === day.value ? "textOnBrand" : "textPrimary"}>{day.number}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <Text variant="bodyStrong">Time</Text>
              {([{"label":"Morning", "time":"10:00", "detail":"9 AM – 12 PM"},{"label":"Afternoon", "time":"14:00", "detail":"12 PM – 5 PM"},{"label":"Evening", "time":"18:30", "detail":"5 PM – 10 PM"},{"label":"Custom time", "time":"CUSTOM", "detail":"Choose an exact time"}] as const).map((slot) => (
                <Pressable key={slot.label} accessibilityRole="radio" accessibilityState={{ selected: slot.time === "CUSTOM" ? customTimeOpen : !customTimeOpen && timeInput === slot.time }} onPress={() => { setCustomTimeOpen(slot.time === "CUSTOM"); if (slot.time !== "CUSTOM") setTimeInput(slot.time); }} style={[styles.timeOption, !customTimeOpen && timeInput === slot.time ? styles.venueRowSelected : null]}>
                  <View style={[styles.radio, (slot.time === "CUSTOM" ? customTimeOpen : !customTimeOpen && timeInput === slot.time) ? styles.radioSelected : null]}>{(slot.time === "CUSTOM" ? customTimeOpen : !customTimeOpen && timeInput === slot.time) ? <View style={styles.radioDot} /> : null}</View>
                  <Text variant="bodyStrong" style={styles.flex}>{slot.label}</Text>
                  <Text variant="caption" color="textSubdued">{slot.detail}</Text>
                </Pressable>
              ))}
              {customTimeOpen ? (
                <DateTimeFields
                  date={dateInput}
                  time={timeInput}
                  onDateChange={setDateInput}
                  onTimeChange={setTimeInput}
                  disabled={sending}
                />
              ) : proposedTime.iso ? (
                <View style={styles.timeSummary}>
                  <Icon name="calendar" size={17} color={palette.brandStrong} />
                  <Text variant="bodyStrong">{formatDateTime(proposedTime.iso)}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.section}>
              <Text variant="titleSm">Review your plan</Text>
              <Text variant="caption" color="textSubdued">
                {conversationId ? "Your group" : personName} can review and respond to your plan.
              </Text>
              <View style={styles.reviewCard}>
                <View style={styles.reviewPlace}>
                  <VenueArtwork photoUrl={selectedVenue?.photoUrl} category={selectedVenue?.category ?? category} style={styles.reviewArtwork} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={2}>{selectedVenue?.name ?? manualName}</Text>
                    <Text variant="caption" color="textSubdued">
                      {categoryConfig.label} · {selectedVenue?.publicLocality ?? manualAddress}
                    </Text>
                  </View>
                </View>
                <View style={styles.reviewRow}>
                  <Icon name="calendar" size={18} color={palette.brandStrong} />
                  <Text variant="bodyStrong" style={styles.flex}>
                    {proposedTime.iso ? formatDateTime(proposedTime.iso) : "Choose a valid time"}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Icon name="location" size={18} color={palette.brandStrong} />
                  <Text variant="body" style={styles.flex} numberOfLines={2}>
                    {selectedVenue?.address ?? manualAddress}
                  </Text>
                </View>
              </View>
              <Text variant="caption" color="textSubdued">
                A proposal is sent to your connection; it is not a venue booking.
              </Text>
            </View>
          ) : null}

          {sendError ? (
            <Text
              variant="caption"
              color="error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {sendError}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={step === 3 ? (params.counterPlanId ? "Send change" : "Send proposal") : "Next"}
            fullWidth
            loading={sending}
            disabled={!hasSubject || (step === 3 && sending)}
            onPress={continuePlan}
          />
        </View>

        <CenterDialog
          visible={manualOpen}
          onClose={() => setManualOpen(false)}
          accessibilityLabel="Add a place"
          keyboardAware
        >
          <View style={styles.dialogContent}>
            <Text variant="titleSm">Add a place</Text>
            <Input
              placeholder="Place name"
              accessibilityLabel="Place name"
              value={manualName}
              onChangeText={setManualName}
              maxLength={200}
              autoFocus
            />
            <Input
              placeholder="Address or area"
              accessibilityLabel="Address or area"
              value={manualAddress}
              onChangeText={setManualAddress}
              maxLength={500}
            />
            <View style={styles.dialogActions}>
              <Button
                label="Close"
                variant="ghost"
                size="sm"
                onPress={() => setManualOpen(false)}
              />
              <Button
                label="Use place"
                size="sm"
                disabled={!manualName.trim() || !manualAddress.trim()}
                onPress={() => {
                  setUsingManual(true);
                  setSelectedVenue(null);
                  setManualOpen(false);
                  setSendError(null);
                }}
              />
            </View>
          </View>
        </CenterDialog>

        <CenterDialog
          visible={locationOpen}
          onClose={() => setLocationOpen(false)}
          accessibilityLabel="Choose search location"
          keyboardAware
        >
          <View style={styles.dialogContent}>
            <Text variant="titleSm">Search area</Text>
            <View style={styles.wrapRow}>
              <Chip
                label={conversationId ? "Near your group" : "Halfway"}
                selected={locationMode === "MIDPOINT"}
                onPress={() => {
                  setLocationMode("MIDPOINT");
                  setArea("");
                  setLocationOpen(false);
                }}
              />
              <Chip
                label="Near me"
                selected={locationMode === "ME"}
                onPress={() => {
                  setLocationMode("ME");
                  setArea("");
                  setLocationOpen(false);
                }}
              />
            </View>
            <Input
              value={areaDraft}
              onChangeText={setAreaDraft}
              placeholder="Search an area"
              returnKeyType="search"
              leftIcon={<Icon name="search" size={17} color={palette.textMuted} />}
              accessibilityLabel="Area name"
            />
            <View style={styles.dialogActions}>
              <Button
                label="Close"
                variant="ghost"
                size="sm"
                onPress={() => setLocationOpen(false)}
              />
              <Button
                label="Show places"
                size="sm"
                disabled={!areaDraft.trim()}
                onPress={() => {
                  setArea(areaDraft.trim());
                  setLocationMode("AREA");
                  setLocationOpen(false);
                }}
              />
            </View>
          </View>
        </CenterDialog>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  safe: { flex: 1 },
  progressWrap: {
    paddingHorizontal: layout.compactScreenPadding,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  progressBars: { flexDirection: "row", gap: spacing.xs },
  progressBar: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: palette.border },
  progressBarActive: { backgroundColor: palette.brandStrong },
  content: {
    width: "100%",
    maxWidth: layout.formMaxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.compactScreenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  section: { gap: spacing.sm },
  activityRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
  },
  venueIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
  },
  reviewRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: spacing.sm,
  },
  reviewPlace: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingVertical: spacing.sm,
  },
  reviewArtwork: { width: 48, height: 48 },
  locationChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: palette.textMuted, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: palette.brandStrong },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.brandStrong },
  dateCard: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  dateStrip: { flexDirection: "row", gap: spacing.xs },
  dayChoice: { width: controlSize.minimumTouchTarget, minHeight: controlSize.minimumTouchTarget, alignItems: "center", justifyContent: "center", gap: spacing.xs, borderRadius: radius.md },
  dayChoiceSelected: { backgroundColor: palette.brandStrong },
  timeOption: { minHeight: controlSize.minimumTouchTarget, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  timeSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: controlSize.minimumTouchTarget,
    borderRadius: radius.control,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  flex: { flex: 1 },
  venueList: {
    gap: spacing.xs,
  },
  venueListLabel: { marginBottom: spacing.xxs },
  venueRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.card,
  },
  venueRowSelected: { borderColor: palette.brandStrong },
  venueRowPressed: { opacity: 0.78 },
  venueArtwork: { width: 48, height: 48 },
  metadataRow: { flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  manualSelection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceMuted,
  },
  secondaryActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  textAction: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  footer: {
    width: "100%",
    maxWidth: layout.formMaxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.compactScreenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
  },
  dialogContent: { gap: spacing.md },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
}));
