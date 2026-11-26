import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { socialApi } from "../../api/endpoints/social";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { formatDateTime } from "../../utils/format";
import { SocialCard, SocialScreen, socialError } from "./SocialScreen";

export function CircleChatHistoryScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Awaited<ReturnType<typeof socialApi.circleChatHistory>>["items"]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const load = useCallback(async (cursor?: string) => {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    if (!cursor) {
      setItems([]);
      setNextCursor(null);
    }
    try {
      const page = await socialApi.circleChatHistory(conversationId, cursor);
      if (generation.current !== request) return;
      setItems(current => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (generation.current === request) setError(socialError(err));
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }, [conversationId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current++; };
  }, [load]));

  return (
    <SocialScreen title="Earlier chats" refresh={() => void load()} busy={busy}>
      {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
      {busy && !items.length ? <Text>Loading earlier chats…</Text> : null}
      {!busy && !error && !items.length && !nextCursor ? <Text>You don’t have any earlier chats for this Circle.</Text> : null}
      {items.map(item => <SocialCard key={item.id}>
        <Text>{formatDateTime(item.createdAt)} – {formatDateTime(item.closedAt)}</Text>
        <Button label="Open read-only chat" variant="secondary" onPress={() => router.push({
          pathname: "/(app)/conversation/[conversationId]",
          params: { conversationId: item.id, history: "1" },
        })} />
      </SocialCard>)}
      {nextCursor ? <Button label="Load more chats" variant="secondary" disabled={busy} onPress={() => void load(nextCursor)} /> : null}
    </SocialScreen>
  );
}
