import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, View } from "react-native";
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
import { useSafeBack } from "../../navigation/useSafeBack";
import { layout, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook } from "../../theme/ThemeContext";
import type { EventListingDto } from "../../types/events";
import type { MatchSummaryDto } from "../../types/match";
import { eventCategoryLabels, eventInvitation, eventPrice, eventSchedule } from "./eventPresentation";

export function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const back = useSafeBack("/(app)/events");
  const styles = useStyles();
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
  const matchSequence = useRef(0);
  const mutationLock = useRef(false);
  const invitationKeys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await eventsApi.get(eventId);
      if (request === sequence.current) { setEvent(result); setError(null); }
    } catch (e) {
      if (request === sequence.current) {
        setEvent(null);
        setError(e instanceof Error ? e.message : "This event couldn’t load.");
      }
    }
  }, [eventId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { sequence.current += 1; matchSequence.current += 1; };
  }, [load]));

  async function loadMatches(next?: string) {
    const request = ++matchSequence.current;
    setMatchesLoading(true);
    setMatchError(null);
    try {
      const page = await matchesApi.list({ limit: 30, cursor: next });
      if (request !== matchSequence.current) return;
      const active = page.items.filter((match) => match.status === "ACTIVE");
      setMatches((previous) => next ? [...previous, ...active.filter((match) => !previous.some((old) => old.id === match.id))] : active);
      setCursor(page.nextCursor);
    } catch (e) {
      if (request === matchSequence.current) setMatchError(e instanceof Error ? e.message : "Your matches couldn’t load.");
    } finally {
      if (request === matchSequence.current) setMatchesLoading(false);
    }
  }

  function closePicker() {
    if (mutationLock.current) return;
    matchSequence.current += 1;
    setPicker(false);
  }

  async function toggleSave() {
    if (!event || mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    try {
      if (event.saved) {
        await eventsApi.unsave(event.id);
        setEvent({ ...event, saved: false });
      } else setEvent(await eventsApi.save(event.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your save couldn’t be updated.");
    } finally { mutationLock.current = false; setBusy(false); }
  }

  async function invite() {
    if (!event || !selected || mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    try {
      const identity = `${event.id}:${event.version}:${selected}`;
      let key = invitationKeys.current.get(identity);
      if (!key) {
        key = `event-${event.id}-${selected}-${Date.now().toString(36)}`;
        invitationKeys.current.set(identity, key);
      }
      const plan = await datePlansApi.create(selected, eventInvitation(event, key));
      setPicker(false);
      router.push({ pathname: "/(app)/date-plan/[datePlanId]", params: { datePlanId: plan.id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setPicker(false);
        setSelected(null);
        await load();
        setError("The event or connection changed. Review the latest details before inviting again.");
      } else setMatchError(e instanceof Error ? e.message : "Your invitation couldn’t be sent. Try again.");
    } finally { mutationLock.current = false; setBusy(false); }
  }

  function openExternal(url: string) {
    // Curated URLs are validated server-side. Never open custom schemes here.
    let target: URL;
    try { target = new URL(url); } catch { return; }
    if (target.protocol !== "https:") return;
    Alert.alert("Open external website?", target.hostname, [
      { text: "Cancel", style: "cancel" },
      { text: "Open", onPress: () => { void Linking.openURL(target.href).catch(() => setError("This link couldn’t open. Please try again.")); } },
    ]);
  }

  return <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <Header title="Event" showBack onLeftPress={back} />
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <View accessibilityLiveRegion="polite" style={styles.section}>
        <Text variant="body" color="textSubdued">{error}</Text>
        {!event ? <Button label="Retry" variant="secondary" onPress={() => void load()} /> : null}
      </View> : null}
      {!event && !error ? <Text variant="body" color="textSubdued">Loading event…</Text> : null}
      {event ? <>
        {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.hero} contentFit="cover" /> : null}
        <Text variant="captionStrong" color="textBrand">{eventCategoryLabels[event.category]}</Text>
        <Text variant="titleSm">{event.title}</Text>
        {event.unavailable ? <Text variant="bodyStrong" color="textBrand">{event.status === "CANCELLED" ? "This event was cancelled" : "Invitations unavailable · check the source for updates"}</Text> : null}
        <Card style={styles.section}>
          <Text variant="bodyStrong">{eventSchedule(event)}</Text>
          <Text variant="caption" color="textSubdued">{event.timezone} · Ends {new Intl.DateTimeFormat("en-IN", { timeZone: event.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(event.endsAt))}</Text>
          <Text variant="bodyStrong">{event.venueName}</Text>
          <Text variant="body" color="textSubdued">{event.venueAddress} · {event.locality}, {event.city}</Text>
          <Text variant="bodyStrong">{eventPrice(event)}</Text>
        </Card>
        <Text variant="body" color="textSubdued">{event.description}</Text>
        <View style={styles.actions}>
          <Button label={event.saved ? "Saved · remove" : "Save privately"} variant="secondary" disabled={busy || (!event.saved && event.unavailable)} onPress={() => void toggleSave()} />
          <Button label="Invite a match" disabled={busy || event.unavailable} onPress={() => {
            setSelected(null); setMatches([]); setCursor(null); setPicker(true); void loadMatches();
          }} />
        </View>
        <Text variant="caption" color="textSubdued">An invitation doesn’t reserve entry or tickets. Saves and invitations aren’t public.</Text>
        <Button label={`Source: ${event.sourceName}`} variant="ghost" onPress={() => openExternal(event.sourceUrl)} />
        <Text variant="caption" color="textSubdued">Details reviewed {new Intl.DateTimeFormat("en-IN", { timeZone: event.timezone, day: "numeric", month: "short", year: "numeric" }).format(new Date(event.verifiedAt))}</Text>
        {event.bookingUrl ? <Button label="Tickets on external website" variant="secondary" onPress={() => openExternal(event.bookingUrl!)} /> : null}
      </> : null}
    </ScrollView>
    <Modal visible={picker} animationType="slide" presentationStyle="fullScreen" onRequestClose={closePicker}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.screen}>
        <Header title="Invite a match" showBack onLeftPress={closePicker} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="caption" color="textSubdued">Choose an existing match. They can accept or decline privately.</Text>
          {matchError ? <View accessibilityLiveRegion="polite" style={styles.section}>
            <Text variant="body" color="textSubdued">{matchError}</Text>
            <Button label="Reload matches" variant="secondary" disabled={busy} onPress={() => void loadMatches()} />
          </View> : null}
          {matchesLoading ? <Text variant="body" color="textSubdued">Loading matches…</Text> : null}
          {!matchesLoading && !matchError && !matches.length ? <Text variant="body" color="textSubdued">No active matches here yet. Following someone doesn’t create a match.</Text> : null}
          {matches.map((match) => <Pressable key={match.id} accessibilityRole="radio" accessibilityState={{ selected: selected === match.id, disabled: busy }}
            disabled={busy} onPress={() => setSelected(match.id)} style={[styles.matchRow, selected === match.id ? styles.selected : null]}>
            <Avatar size={44} initials={match.otherUser.displayName} uri={match.otherUser.photos.find((photo) => photo.isPrimary)?.url ?? match.otherUser.photos[0]?.url} />
            <Text variant="bodyStrong" style={styles.flex}>{match.otherUser.displayName}</Text>
            {selected === match.id ? <Text variant="captionStrong" color="textBrand">Selected</Text> : null}
          </Pressable>)}
          {cursor ? <Button label="More matches" variant="secondary" disabled={matchesLoading || busy} onPress={() => void loadMatches(cursor)} /> : null}
          <Button label="Send invitation" disabled={!selected || busy || matchesLoading} loading={busy} onPress={() => void invite()} />
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
