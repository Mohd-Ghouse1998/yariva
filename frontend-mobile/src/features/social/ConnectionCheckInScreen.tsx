import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { AppState, View } from "react-native";
import { socialApi, type CheckIn } from "../../api/endpoints/social";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { CONNECTION_INTENT_LABELS, CONNECTION_INTENT_OPTIONS } from "../../config/connectionIntents";
import { spacing } from "../../theme/spacing";
import type { ConnectionIntent } from "../../types/enums";
import { SocialCard, SocialScreen, socialError } from "./SocialScreen";

export function ConnectionCheckInScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [data, setData] = useState<CheckIn>();
  const [draftIntent, setDraftIntent] = useState<ConnectionIntent>();
  const [answers, setAnswers] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pendingRequest = useRef<{ background: boolean } | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (!conversationId || (pendingRequest.current && (!pendingRequest.current.background || !showLoading))) return;
    const request = { background: !showLoading };
    pendingRequest.current = request;
    if (showLoading) setLoading(true);
    try {
      const fresh = await socialApi.checkIn(conversationId);
      if (pendingRequest.current !== request) return;
      setData(fresh);
      if (showLoading) setDraftIntent(undefined);
      setError("");
    } catch (err) {
      if (pendingRequest.current !== request) return;
      setData(undefined);
      setError(socialError(err));
    } finally {
      if (pendingRequest.current === request) {
        pendingRequest.current = null;
        if (showLoading) setLoading(false);
      }
    }
  }, [conversationId]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void refresh(false);
    }, 15_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh(false);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]));

  async function mutate(action: () => Promise<CheckIn>, clearAnswers = false) {
    if (pendingRequest.current && !pendingRequest.current.background) return;
    const request = { background: false };
    pendingRequest.current = request;
    setSaving(true);
    setError("");
    try {
      const fresh = await action();
      setData(fresh);
      setDraftIntent(undefined);
      if (clearAnswers) setAnswers(["", ""]);
    } catch (err) {
      pendingRequest.current = null;
      if (err instanceof ApiError && [404, 409].includes(err.status)) await refresh();
      setError(socialError(err));
    } finally {
      if (pendingRequest.current === request) pendingRequest.current = null;
      setSaving(false);
    }
  }

  const intent = draftIntent ?? data?.intent.mine ?? null;
  const vibe = data?.vibe;
  const busy = saving || loading;
  function act(action: "START" | "ACCEPT" | "ANSWER" | "SKIP") {
    if (!conversationId || !vibe) return;
    void mutate(() => socialApi.vibe(conversationId, action, vibe.version, action === "ANSWER" ? answers : undefined), true);
  }

  return <SocialScreen title="Connection check-in" refresh={() => void refresh()} busy={loading}>
    {loading && !data ? <Text>Loading check-in…</Text> : null}
    {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
    {data && conversationId ? <SocialCard>
      <Text variant="titleSm" accessibilityRole="header">Shared intention</Text>
      <Text accessibilityLiveRegion="polite">
        {data.intent.common ? `You both chose ${CONNECTION_INTENT_LABELS[data.intent.common].toLowerCase()}.`
          : data.intent.pending ? "An intention check-in is open. Choose an intention if you’d like to take part."
          : data.intent.mine ? "Your choice is saved privately. A shared intention appears when you both choose the same one."
          : "Choose what you want for this connection. Your choice stays private until you both agree."}
      </Text>
      {CONNECTION_INTENT_OPTIONS.map((option) => (
        <Button key={option.value} label={option.label} variant={intent === option.value ? "primary" : "secondary"}
          accessibilityState={{ selected: intent === option.value }} disabled={busy} onPress={() => setDraftIntent(option.value)} />
      ))}
      <Button label="Save intention" disabled={busy || intent === null || intent === data.intent.mine}
        onPress={() => void mutate(() => socialApi.setIntent(conversationId, intent, data.intent.version))} />
      {data.intent.mine ? <Button label="Withdraw intention" variant="secondary" disabled={busy}
        onPress={() => void mutate(() => socialApi.setIntent(conversationId, null, data.intent.version))} /> : null}
    </SocialCard> : null}
    {vibe ? <SocialCard>
      <Text variant="titleSm" accessibilityRole="header">Vibe Together</Text>
      {vibe.state === "IDLE" ? <>
        <Text>Try two optional prompts. You each see both sets of answers after you’ve both submitted.</Text>
        <Button label="Invite to answer prompts" disabled={busy} onPress={() => act("START")} />
      </> : null}
      {vibe.state === "INVITED" ? <Text accessibilityLiveRegion="polite">Waiting for your chat partner to accept. Pull down to check for updates.</Text> : null}
      {vibe.state === "CAN_ACCEPT" ? <>
        <Text>Your chat partner invited you to answer two prompts together.</Text>
        <Button label="Accept prompt invitation" disabled={busy} onPress={() => act("ACCEPT")} />
      </> : null}
      {vibe.state === "ANSWER" ? <>
        {vibe.prompts.map((prompt, index) => <Input key={prompt} label={prompt} maxLength={160} multiline value={answers[index]}
          editable={!busy} onChangeText={(value) => setAnswers((current) => current.map((answer, i) => i === index ? value : answer))} />)}
        <Button label="Submit both answers" disabled={busy || answers.some((answer) => !answer.trim())} onPress={() => act("ANSWER")} />
      </> : null}
      {vibe.state === "WAITING" || vibe.state === "SHARED" ? <>
        {vibe.state === "WAITING" ? <Text accessibilityLiveRegion="polite">Waiting for the other answers. Pull down to check for updates.</Text> : null}
        {vibe.prompts.map((prompt, index) => <View key={prompt} style={{ gap: spacing.xs }}>
          <Text variant="bodyStrong">{prompt}</Text>
          <Text color="textSubdued">Your answer</Text><Text>{vibe.mine[index]}</Text>
          {vibe.state === "SHARED" ? <><Text color="textSubdued">Their answer</Text><Text>{vibe.theirs[index]}</Text></> : null}
        </View>)}
      </> : null}
      {vibe.state !== "IDLE" ? <Button label={vibe.state === "SHARED" ? "Remove shared answers" : "Skip prompts"}
        variant="secondary" disabled={busy} onPress={() => act("SKIP")} /> : null}
    </SocialCard> : null}
  </SocialScreen>;
}
