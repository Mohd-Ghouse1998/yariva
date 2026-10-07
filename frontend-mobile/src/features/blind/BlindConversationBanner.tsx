import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { blindApi } from "../../api/endpoints/blind";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Text } from "../../components/ui/Text";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/spacing";
import type { BlindPolicy } from "../../types/blind";
import { blindPresentation } from "./blindLogic";
import { VibeBlurContainer } from "./VibeBlurContainer";

export function BlindConversationBanner({ matchId, onRevealed, onPolicy }: { matchId: string; onRevealed: () => void; onPolicy: (active: boolean) => void }) {
  const [policy, setPolicy] = useState<BlindPolicy | null>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const { palette } = useTheme(); const realtime = useRealtime();
  const previousBlind = useRef<boolean | null>(null); const callback = useRef(onRevealed); callback.current = onRevealed;
  const policyCallback = useRef(onPolicy); policyCallback.current = onPolicy;
  const reconcile = useCallback(async () => {
    try {
      const response = await blindApi.relationship(matchId);
      const active = response.blind?.isBlindVibeActive ?? false;
      if (previousBlind.current && !active) callback.current();
      previousBlind.current = active; setPolicy(response.blind); policyCallback.current(active); setError(null);
    } catch { setError("Couldn’t refresh photo status."); }
  }, [matchId]);
  useFocusEffect(useCallback(() => {
    void reconcile();
    const interval = setInterval(() => { if (AppState.currentState === "active") void reconcile(); }, 10000);
    const resume = AppState.addEventListener("change", state => { if (state === "active") void reconcile(); });
    const off = realtime.onMessageCreated(() => { void reconcile(); });
    return () => { clearInterval(interval); resume.remove(); off(); };
  }, [reconcile, realtime]));
  if (!policy) return null;
  const { progress, count } = blindPresentation(policy);
  return <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.border, gap: spacing.sm }}>
    <VibeBlurContainer isBlindVibeActive={policy.isBlindVibeActive} interactionCount={count} effectiveBlindVibePolicy={policy}>
      <Text variant="bodyStrong">{policy.isBlindVibeActive ? "Photos stay private" : "Photos revealed"}</Text>
      <Text variant="caption" color="textSubdued">{policy.isBlindVibeActive ? `${policy.myCount}/${policy.perParticipantTarget} from you · ${count - policy.myCount}/${policy.perParticipantTarget} from them` : "Keep the conversation going."}</Text>
    </VibeBlurContainer>
    {policy.isBlindVibeActive ? <>
      <View accessibilityRole="progressbar" accessibilityLabel="Photo reveal progress" accessibilityValue={{ min: 0, max: policy.revealThreshold, now: count }} style={{ height: 3, backgroundColor: palette.surfaceSubdued }}><View style={{ height: 3, width: `${progress * 100}%`, backgroundColor: palette.blindAccent }} /></View>
      <Button label={policy.myRevealConsent ? "Waiting for their consent" : policy.otherRevealConsent ? "They’re ready · Reveal together" : "Reveal together"} variant="ghost" size="sm" disabled={policy.myRevealConsent || Boolean(error)} onPress={() => setOpen(true)} />
    </> : null}
    {error ? <Button label={`${error} Retry`} variant="ghost" size="sm" onPress={() => void reconcile()} /> : null}
    <CenterDialog visible={open} onClose={() => setOpen(false)} accessibilityLabel="Reveal photos together" style={{ gap: spacing.md }}>
      <Text variant="heading">Ready to reveal?</Text><Text color="textSubdued">Your photos unlock only when both of you agree. Repeated or rapid texts don’t add progress.</Text>
      <Button label="I’m ready" loading={busy} onPress={() => { setBusy(true); void blindApi.reveal(matchId).then(async () => { setOpen(false); await reconcile(); }).catch(() => setError("Couldn’t save your consent.")).finally(() => setBusy(false)); }} />
      <Button label="Keep chatting" variant="ghost" onPress={() => setOpen(false)} />
    </CenterDialog>
  </View>;
}
