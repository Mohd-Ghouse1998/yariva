import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { blindApi } from "../../api/endpoints/blind";
import { Header } from "../../components/layout/Header";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Chip } from "../../components/ui/Chip";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useSafeBack } from "../../navigation/useSafeBack";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { useResponsiveLayout } from "../../theme/responsive";
import { syncPushRegistration } from "../../notifications/pushRegistration";
import { useToast } from "../../components/ui/Toast";
import type { BlindEvent, BlindPerson } from "../../types/blind";

export function BlindEventScreen() {
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>();
  const router = useRouter(), goBack = useSafeBack("/(app)/(tabs)/discover");
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();
  const toast = useToast();
  const [event, setEvent] = useState<BlindEvent | null>(null), [people, setPeople] = useState<BlindPerson[]>([]);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [joinOpen, setJoinOpen] = useState(false);
  const [intent, setIntent] = useState<"DATING" | "FRIENDSHIP">("DATING"), [notify, setNotify] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = await blindApi.event(occurrenceId); setEvent(next);
      setPeople(next.occurrence.state === "LIVE" && next.enrollment?.state === "JOINED" ? (await blindApi.people(next.occurrence.id)).items : []);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t refresh. Check your connection."); }
  }, [occurrenceId]);
  useFocusEffect(useCallback(() => {
    void load(); const timer = setInterval(() => { if (AppState.currentState === "active") void load(); }, 15000);
    const resume = AppState.addEventListener("change", state => { if (state === "active") void load(); });
    return () => { clearInterval(timer); resume.remove(); };
  }, [load]));
  const act = async (operation: () => Promise<unknown>) => { setBusy(true); try { await operation(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); } };
  const state = event?.occurrence.state, joined = event?.enrollment?.state === "JOINED";
  const openChat = (conversationId: string) => router.push({ pathname: "/(app)/conversation/[conversationId]", params: { conversationId } });
  return <Screen scroll contentStyle={{ gap: spacing.lg }}>
    <View style={{ marginHorizontal: -responsive.screenPadding }}><Header title="Blind Vibe" showBack onLeftPress={goBack} /></View>
    {!event && !error ? <ActivityIndicator color={palette.blindAccent} /> : null}
    {event ? <>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">Conversation first.</Text>
        <Text color="textSubdued">{new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: event.occurrence.timezone }).format(new Date(event.occurrence.startsAt))} · {new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: event.occurrence.timezone }).format(new Date(event.occurrence.startsAt))}–{new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: event.occurrence.timezone }).format(new Date(event.occurrence.endsAt))} IST</Text>
        <Text variant="caption" color="textBrand">{state === "LIVE" ? "Open now" : state === "CANCELLED" ? "Event cancelled" : state === "ENDED" ? "Event ended" : joined ? "You’re in" : event.enrollment?.state === "LEFT" ? "You left this event" : "Thursday introductions"} · {event.occurrence.city}</Text>
      </View>
      {state === "ENDED" || state === "CANCELLED" ? <Text color="textSubdued">Introductions are closed. Your existing chats stay yours.</Text> : joined ? <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text variant="bodyStrong">{event.enrollment?.intent === "DATING" ? "Dating" : "Friendship"}</Text><Button label="Leave event" variant="ghost" size="sm" loading={busy} onPress={() => void act(() => blindApi.leave(event.occurrence.id))} /></View> : <Button label={event.enrollment?.state === "LEFT" ? "Join again" : "Join Blind Vibe"} onPress={() => setJoinOpen(true)} leftIcon={<Icon name="eyeOff" color={palette.textOnBrand} size={18} />} />}
      {state === "UPCOMING" && joined ? <Text color="textSubdued">Come back when the event opens.</Text> : null}
      {state === "LIVE" && joined && people.length === 0 ? <Text color="textSubdued">No new introductions right now. Check back during the event.</Text> : null}
      {people.map(person => <Card key={person.userId} style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><Icon name="lock" color={palette.blindAccent} size={20} /><View style={{ flex: 1 }}><Text variant="bodyStrong">{person.displayName}</Text>{person.headline ? <Text numberOfLines={2} color="textSubdued">{person.headline}</Text> : null}</View></View>
        <Button label={person.interestSent ? "Interest sent" : "Let’s connect"} size="sm" variant={person.interestSent ? "secondary" : "primary"} disabled={person.interestSent || busy || Boolean(error)} onPress={() => void act(async () => { const result = await blindApi.interest(event.occurrence.id, person.userId); if (result.conversationId) openChat(result.conversationId); })} />
      </Card>)}
      {event.matches.length > 0 ? <Text variant="bodyStrong">Your connections</Text> : null}
      {event.matches.map(match => <Button key={match.conversationId} label={`Chat with ${match.displayName}`} variant="secondary" onPress={() => openChat(match.conversationId)} leftIcon={<Icon name="chat" size={18} color={palette.blindAccent} />} />)}
    </> : null}
    {error ? <View style={{ gap: spacing.sm }}><Text color="error" accessibilityRole="alert">{error}</Text><Button label="Retry" variant="secondary" onPress={() => void load()} /></View> : null}
    <CenterDialog visible={joinOpen} onClose={() => setJoinOpen(false)} accessibilityLabel="Join Blind Vibe" style={{ gap: spacing.md }}>
      <Text variant="heading">Meet through conversation</Text>
      <Text color="textSubdued">Photos stay private until you each send five eligible texts, or both choose to reveal.</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}><Chip label="Dating" selected={intent === "DATING"} onPress={() => setIntent("DATING")} /><Chip label="Friendship" selected={intent === "FRIENDSHIP"} onPress={() => setIntent("FRIENDSHIP")} /></View>
      <ToggleRow label="Event reminders" value={notify} onValueChange={enabled => { if (!enabled) { setNotify(false); return; } void syncPushRegistration(true).then(result => { setNotify(result === "REGISTERED"); if (result !== "REGISTERED") toast.show("Enable notifications in phone settings for reminders.", "info"); }).catch(() => toast.show("Push reminders aren’t available on this build yet.", "info")); }} />
      <Button label="Agree & join" loading={busy} onPress={() => void act(async () => { if (event) { await blindApi.join(event.occurrence.id, intent, notify); setJoinOpen(false); } })} />
      <Button label="Not now" variant="ghost" onPress={() => setJoinOpen(false)} />
    </CenterDialog>
  </Screen>;
}
