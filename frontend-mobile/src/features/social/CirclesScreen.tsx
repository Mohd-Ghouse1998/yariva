import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { CONNECTION_INTENT_LABELS, CONNECTION_INTENT_OPTIONS } from "../../config/connectionIntents";
import type { ConnectionIntent } from "../../types/enums";
import { socialApi, type CircleListScope, type CircleSummary } from "../../api/endpoints/social";
import { formatDateTime } from "../../utils/format";
import { ActivityReceipt, stateLabel } from "./ActivityReceipt";
import { SocialCard, SocialScreen, socialError } from "./SocialScreen";

export function CirclesScreen() {
  const router = useRouter();
  const [pages, setPages] = useState<Record<CircleListScope, Awaited<ReturnType<typeof socialApi.list>>>>();
  const generation = useRef(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [intent, setIntent] = useState<ConnectionIntent>("FRIENDSHIP");
  const [capacity, setCapacity] = useState(4);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    try {
      const [own, nearby] = await Promise.all([socialApi.list("own"), socialApi.list("nearby")]);
      if (current !== generation.current) return;
      setPages({ own, nearby });
      setError("");
    } catch (err) {
      if (current !== generation.current) return;
      setPages(undefined);
      setError(socialError(err));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const open = (circleId: string, activityId?: string) => router.push({ pathname: "/(app)/circles/[circleId]", params: { circleId, activityId } });

  async function create() {
    setSaving(true);
    setError("");
    try {
      const circle = await socialApi.create({ title: title.trim(), description: description.trim(), intent, capacity });
      setForm(false);
      setTitle("");
      setDescription("");
      open(circle.id);
    } catch (err) {
      setError(socialError(err));
    } finally {
      setSaving(false);
    }
  }

  async function resolveUnavailable(action: () => Promise<unknown>) {
    setSaving(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(socialError(err));
    } finally {
      setSaving(false);
    }
  }

  async function loadMore(scope: CircleListScope) {
    const cursor = pages?.[scope].nextCursor;
    if (!cursor || busy) return;
    const current = ++generation.current;
    setBusy(true);
    try {
      const next = await socialApi.list(scope, cursor);
      if (current !== generation.current) return;
      setPages((previous) => previous && {
        ...previous,
        [scope]: { ...next, items: [...new Map([...previous[scope].items, ...next.items].map((item) => [item.id, item])).values()] },
      });
      setError("");
    } catch (err) {
      if (current === generation.current) setError(socialError(err));
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }

  const active = (status: string | null) => status === "PENDING" || status === "APPROVED";
  const renderCircle = (item: CircleSummary) => (
    <SocialCard key={item.id}>
      <Text variant="bodyStrong">{item.title}</Text>
      {item.redacted ? <>
        <Text color="textSubdued">{stateLabel(item.state)}</Text>
        {item.state === "UNAVAILABLE" && (item.organizer ? <>
          <Button label="Recover unavailable participation" variant="secondary" disabled={saving}
            onPress={() => void resolveUnavailable(() => socialApi.recover(item.id))} />
          <Button label="Close circle" variant="secondary" disabled={saving}
            onPress={() => void resolveUnavailable(() => socialApi.close(item.id, false))} />
        </> : active(item.ownStatus) ? (
          <Button label={item.ownStatus === "PENDING" ? "Withdraw request" : "Leave circle"} variant="secondary"
            disabled={saving} onPress={() => void resolveUnavailable(() => socialApi.leave(item.id))} />
        ) : null)}
      </> : <>
        {item.intent ? <Text color="textSubdued">{CONNECTION_INTENT_LABELS[item.intent]} · {item.locality}</Text> : null}
        <Text color="textSubdued">{item.approvedCount}/{item.capacity} members · {stateLabel(item.state)}{item.ownStatus ? ` · ${stateLabel(item.ownStatus)}` : ""}</Text>
        <Button label={`View ${item.title}`} variant="secondary" onPress={() => open(item.id)} />
      </>}
    </SocialCard>
  );
  const renderActivity = (circle: CircleSummary, activity: CircleSummary["activities"][number]) => activity.redacted ? (
    <ActivityReceipt key={activity.id} activity={activity} saving={saving}
      withdraw={(need) => void resolveUnavailable(() => socialApi.respond(circle.id, activity.id, need, true))} />
  ) : (
    <SocialCard key={activity.id}>
      <Text variant="bodyStrong">{activity.title}</Text>
      {circle.intent ? <Text color="textSubdued">{CONNECTION_INTENT_LABELS[circle.intent]} · {circle.locality}</Text> : null}
      <Text color="textSubdued">{activity.startsAt ? formatDateTime(activity.startsAt) : "Time to be decided"} · {stateLabel(activity.state)}</Text>
      <Button label={`View ${activity.title}`} variant="secondary" onPress={() => open(circle.id, activity.id)} />
    </SocialCard>
  );
  return (
    <SocialScreen title="Circles & activities" refresh={() => void refresh()} busy={busy}>
      {error ? <Text accessibilityRole="alert" color="error">{error}</Text> : null}
      {busy && !pages ? <Text>Loading nearby circles…</Text> : null}
      {pages ? <Button label={form ? "Close form" : "Start a circle"} variant="secondary" onPress={() => setForm(!form)} disabled={saving} /> : null}
      {form && pages ? (
        <SocialCard>
          <Input label="Circle name" value={title} onChangeText={setTitle} maxLength={80} />
          <Input label="Purpose" helper="Visible in Discover. Leave out contact details and private addresses." value={description} onChangeText={setDescription} maxLength={500} multiline />
          <Text variant="bodyStrong">Intention</Text>
          {CONNECTION_INTENT_OPTIONS.map((option) => (
            <Button key={option.value} label={option.label} variant={option.value === intent ? "primary" : "secondary"}
              accessibilityState={{ selected: option.value === intent }} onPress={() => setIntent(option.value)} disabled={saving} />
          ))}
          <Text variant="bodyStrong">Seats, including you</Text>
          {[4, 5, 6].map((count) => <Button key={count} label={`${count} seats`} variant={count === capacity ? "primary" : "secondary"}
            accessibilityState={{ selected: count === capacity }} onPress={() => setCapacity(count)} disabled={saving} />)}
          <Button label="Create circle" loading={saving} disabled={!title.trim() || !description.trim()} onPress={() => void create()} />
        </SocialCard>
      ) : null}
      {pages && !form ? <>
        <Text variant="titleSm" accessibilityRole="header">Your circles & responses</Text>
        {pages.own.items.map((item) => (
          <React.Fragment key={item.id}>
            {(item.ownStatus || item.organizer) ? renderCircle(item) : null}
            {item.activities.filter((activity) => activity.mine.length > 0 || activity.openToNearby)
              .map((activity) => renderActivity(item, activity))}
          </React.Fragment>
        ))}
        {pages.own.nextCursor ? <Button label="Load more of your circles" variant="secondary" disabled={busy} onPress={() => void loadMore("own")} /> :
          !pages.own.items.length ? <Text color="textSubdued">Your circles and responses will appear here.</Text> : null}
        <Text variant="titleSm" accessibilityRole="header">Nearby circles & activities</Text>
        {pages.nearby.items.map((item) => (
          <React.Fragment key={item.id}>
            {renderCircle(item)}
            {item.activities.filter((activity) => activity.openToNearby).map((activity) => renderActivity(item, activity))}
          </React.Fragment>
        ))}
        {pages.nearby.nextCursor ? <Button label="Load more nearby" variant="secondary" disabled={busy} onPress={() => void loadMore("nearby")} /> :
          !pages.nearby.items.length ? <Text color="textSubdued">No eligible circles to show right now.</Text> : null}
      </> : null}
    </SocialScreen>
  );
}
