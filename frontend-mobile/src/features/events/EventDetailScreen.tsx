import { uuid } from "expo-modules-core";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { datePlansApi } from "../../api/endpoints/datePlans";
import { eventsApi } from "../../api/endpoints/events";
import { matchesApi } from "../../api/endpoints/matches";
import { ApiError } from "../../api/errors";
import { Header } from "../../components/layout/Header";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Text } from "../../components/ui/Text";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useLocalization } from "../../localization/LocalizationContext";
import { layout, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook } from "../../theme/ThemeContext";
import type { EventListingDto } from "../../types/events";
import type { MatchSummaryDto } from "../../types/match";
import { eventCategoryLabel, eventDate, eventFailureCopy, eventInvitation, eventPrice, eventRefreshAt, eventSchedule } from "./eventPresentation";

export function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const back = useSafeBack("/(app)/events");
  const styles = useStyles();
  const { t, language } = useLocalization();
  const realtime = useRealtime();
  const [event, setEvent] = useState<EventListingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [matches, setMatches] = useState<MatchSummaryDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const sequence = useRef(0);
  const focused = useRef(false);
  const foreground = useRef(true);
  const receivedAt = useRef(Date.now());
  const matchSequence = useRef(0);
  const matchPending = useRef(false);
  const mutationLock = useRef(false);
  const invitationKeys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    if (!focused.current || !foreground.current) return;
    const request = ++sequence.current;
    matchSequence.current += 1;
    matchPending.current = false;
    setPicker(false); setSelected(null); setMatches([]); setMatchesLoading(false);
    setEvent(null);
    setError(null);
    try {
      const result = await eventsApi.get(eventId);
      if (request === sequence.current) { receivedAt.current = Date.now(); setEvent(result); setError(null); }
    } catch (e) {
      if (request === sequence.current) {
        setEvent(null);
        setError(eventFailureCopy(e, t, "events.detail.load.error"));
      }
    }
  }, [eventId, t]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    foreground.current = AppState.currentState !== "background" && AppState.currentState !== "inactive";
    void load();
    const invalidate = () => {
      sequence.current += 1; matchSequence.current += 1; matchPending.current = false;
      setEvent(null); setPicker(false); setSelected(null); setMatches([]); setMatchesLoading(false);
    };
    const listener = AppState.addEventListener("change", state => {
      foreground.current = state === "active";
      if (foreground.current) void load();
      else invalidate();
    });
    const unsubscribe = realtime.onNotification(({ notification }) => {
      if (foreground.current && notification.data?.route === "event-plan-change" && notification.data.eventId === eventId) {
        invalidate(); void load();
      }
    });
    return () => { focused.current = false; listener.remove(); unsubscribe(); invalidate(); };
  }, [load, realtime, eventId]));

  useEffect(() => {
    if (!event || !focused.current || !foreground.current) return;
    const deadline = eventRefreshAt(event, receivedAt.current);
    if (deadline === null) return;
    const timer = setTimeout(() => { if (focused.current && foreground.current) { setPicker(false); setSelected(null); void load(); } }, Math.max(1, Math.min(2147483647, deadline - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [event, load]);

  async function loadMatches(next?: string) {
    if (matchPending.current) return;
    matchPending.current = true;
    const request = ++matchSequence.current;
    setMatchesLoading(true);
    if (!next) setSelected(null);
    setMatchError(null);
    try {
      const page = await matchesApi.list({ limit: 30, cursor: next });
      if (request !== matchSequence.current) return;
      const active = page.items.filter((match) => match.status === "ACTIVE");
      setMatches((previous) => next ? [...previous, ...active.filter((match) => !previous.some((old) => old.id === match.id))] : active);
      setCursor(page.nextCursor);
    } catch (e) {
      if (request === matchSequence.current) setMatchError(eventFailureCopy(e, t, "events.detail.matches.error"));
    } finally {
      if (request === matchSequence.current) { setMatchesLoading(false); matchPending.current = false; }
    }
  }

  function closePicker() {
    if (mutationLock.current) return;
    matchSequence.current += 1;
    setPicker(false);
    matchPending.current = false;
    setMatchesLoading(false);
  }

  async function toggleSave() {
    if (!event || mutationLock.current) return;
    mutationLock.current = true;
    const request = sequence.current;
    setBusy(true);
    try {
      if (event.saved) {
        await eventsApi.unsave(event.id);
        if (request === sequence.current) setEvent({ ...event, saved: false });
      } else {
        const updated = await eventsApi.save(event.id);
        if (request === sequence.current) { receivedAt.current = Date.now(); setEvent(updated); }
      }
      if (request === sequence.current) setError(null);
    } catch (e) {
      if (request !== sequence.current) return;
      if (e instanceof ApiError && e.status === 409) {
        await load();
        setError(t("events.detail.changed"));
      } else setError(eventFailureCopy(e, t, "events.detail.save.error"));
    } finally { mutationLock.current = false; setBusy(false); }
  }

  async function invite() {
    if (!event || !selected || mutationLock.current) return;
    mutationLock.current = true;
    const request = sequence.current;
    setBusy(true);
    try {
      const identity = `${event.id}:${event.version}:${selected}`;
      let key = invitationKeys.current.get(identity);
      if (!key) {
        key = `event-${uuid.v4()}`;
        invitationKeys.current.set(identity, key);
      }
      const plan = await datePlansApi.create(selected, eventInvitation(event, key));
      if (request !== sequence.current) return;
      setPicker(false);
      router.push({ pathname: "/(app)/date-plan/[datePlanId]", params: { datePlanId: plan.id } });
    } catch (e) {
      if (request !== sequence.current) return;
      if (e instanceof ApiError && e.status === 409) {
        setPicker(false);
        setSelected(null);
        await load();
        setError(t("events.detail.changed"));
      } else setMatchError(eventFailureCopy(e, t, "events.detail.send.error"));
    } finally { mutationLock.current = false; setBusy(false); }
  }

  function openExternal(url: string) {
    // Curated URLs are validated server-side. Never open custom schemes here.
    let target: URL;
    try { target = new URL(url); } catch { return; }
    if (target.protocol !== "https:") return;
    Alert.alert(t("events.detail.external.title"), target.hostname, [
      { text: t("events.detail.external.cancel"), style: "cancel" },
      { text: t("events.detail.external.open"), onPress: () => { void Linking.openURL(target.href).catch(() => setError(t("events.detail.external.error"))); } },
    ]);
  }

  return <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <Header title={t("events.detail.title")} showBack onLeftPress={back} />
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <View accessibilityLiveRegion="polite" style={styles.section}>
        <Text variant="body" color="textSubdued">{error}</Text>
        {!event ? <Button label={t("events.retry")} variant="secondary" onPress={() => void load()} /> : null}
      </View> : null}
      {!event && !error ? <Text variant="body" color="textSubdued">{t("events.detail.loading")}</Text> : null}
      {event ? <>
        {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.hero} contentFit="cover" /> : null}
        <Text variant="captionStrong" color="textBrand">{eventCategoryLabel(event.category, t)}</Text>
        <Text variant="titleSm">{event.title}</Text>
        {event.unavailable ? <Text variant="bodyStrong" color="textBrand">{event.status === "CANCELLED" ? t("events.detail.cancelled") : t("events.detail.unavailable")}</Text> : null}
        <Card style={styles.section}>
          <Text variant="bodyStrong">{eventSchedule(event, language)}</Text>
          <Text variant="caption" color="textSubdued">{t("events.detail.ends", { timezone: event.timezone, time: eventDate(event.endsAt, event.timezone, language, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}</Text>
          <Text variant="bodyStrong">{event.venueName}</Text>
          <Text variant="body" color="textSubdued">{event.venueAddress} · {event.locality}, {event.city}</Text>
          <Text variant="bodyStrong">{eventPrice(event, language, t)}</Text>
        </Card>
        <Text variant="body" color="textSubdued">{event.description}</Text>
        <View style={styles.actions}>
          <Button label={event.saved ? t("events.detail.saved") : t("events.detail.save")} variant="secondary" disabled={busy || (!event.saved && event.unavailable)} onPress={() => void toggleSave()} />
          <Button label={t("events.detail.invite")} disabled={busy || event.unavailable} onPress={() => {
            setSelected(null); setMatches([]); setCursor(null); setPicker(true); void loadMatches();
          }} />
        </View>
        <Text variant="caption" color="textSubdued">{t("events.detail.disclaimer")}</Text>
        <Button label={t("events.detail.source", { source: event.sourceName })} variant="ghost" onPress={() => openExternal(event.sourceUrl)} />
        <Text variant="caption" color="textSubdued">{t("events.reviewed", { date: eventDate(event.verifiedAt, event.timezone, language, { day: "numeric", month: "short", year: "numeric" }) })}</Text>
        <Button label={t("events.report")} variant="ghost" onPress={() => router.push({ pathname: "/(app)/report", params: { targetType: "EVENT_LISTING", targetId: event.id } })} />
        {event.bookingUrl ? <Button label={t("events.detail.tickets")} variant="secondary" onPress={() => openExternal(event.bookingUrl!)} /> : null}
      </> : null}
    </ScrollView>
    <Modal visible={picker} animationType="slide" presentationStyle="fullScreen" onRequestClose={closePicker}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
        <Header title={t("events.detail.invite")} showBack onLeftPress={closePicker} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="caption" color="textSubdued">{t("events.detail.matches.hint")}</Text>
          {matchError ? <View accessibilityLiveRegion="polite" style={styles.section}>
            <Text variant="body" color="textSubdued">{matchError}</Text>
            <Button label={t("events.detail.matches.reload")} variant="secondary" disabled={busy} onPress={() => void loadMatches()} />
          </View> : null}
          {matchesLoading ? <Text variant="body" color="textSubdued">{t("events.detail.matches.loading")}</Text> : null}
          {!matchesLoading && !matchError && !matches.length ? <Text variant="body" color="textSubdued">{t("events.detail.matches.empty")}</Text> : null}
          {matches.map((match) => <Pressable key={match.id} accessibilityRole="radio" accessibilityState={{ selected: selected === match.id, disabled: busy }}
            disabled={busy} onPress={() => setSelected(match.id)} style={[styles.matchRow, selected === match.id ? styles.selected : null]}>
            <Avatar size={44} initials={match.otherUser.displayName} uri={match.otherUser.photos.find((photo) => photo.isPrimary)?.url ?? match.otherUser.photos[0]?.url} />
            <Text variant="bodyStrong" style={styles.flex}>{match.otherUser.displayName}</Text>
            {selected === match.id ? <Text variant="captionStrong" color="textBrand">{t("events.detail.selected")}</Text> : null}
          </Pressable>)}
          {cursor ? <Button label={t("events.detail.matches.more")} variant="secondary" disabled={matchesLoading || busy} onPress={() => void loadMatches(cursor)} /> : null}
          <Button label={t("events.detail.send")} disabled={!selected || busy || matchesLoading || !matches.some(match => match.id === selected)} loading={busy} onPress={() => void invite()} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const useStyles = createThemeStyleHook((p) => ({
  screen: { flex: 1, backgroundColor: p.background },
  content: { width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center", padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { width: "100%", aspectRatio: 1.6, borderRadius: radius.card },
  section: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  matchRow: { minHeight: 64, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: p.border, borderRadius: radius.control },
  selected: { borderColor: p.brandStrong, backgroundColor: p.surfaceMuted },
  flex: { flex: 1 },
}));
