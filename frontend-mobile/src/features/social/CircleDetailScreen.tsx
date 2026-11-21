import React, { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { socialApi, type CircleDetail, type Venue } from "../../api/endpoints/social";
import { ApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { CONNECTION_INTENT_LABELS } from "../../config/connectionIntents";
import { spacing } from "../../theme/spacing";
import { ActivityReceipt, stateLabel } from "./ActivityReceipt";
import { formatDateTime } from "../../utils/format";
import { DateTimeFields } from "../datePlans/DateTimeFields";
import { formatLocalDateValue, formatLocalTimeValue, parseLocalDateTime } from "../datePlans/datePlanLogic";
import { SocialCard, SocialScreen, socialError } from "./SocialScreen";

type Activity = CircleDetail["activities"][number];
const active = (status?: string) => status === "PENDING" || status === "APPROVED";


export function CircleDetailScreen() {
  const { circleId, activityId } = useLocalSearchParams<{ circleId: string; activityId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [circle, setCircle] = useState<CircleDetail>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Activity | "new">();

  const refresh = useCallback(async () => {
    if (!circleId) return;
    setLoading(true);
    try {
      setCircle(await socialApi.circle(circleId));
      setError("");
    } catch (err) {
      setCircle(undefined);
      setEditing(undefined);
      setError(socialError(err));
    } finally {
      setLoading(false);
    }
  }, [circleId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function mutate(action: () => Promise<unknown>, after?: () => void, onConflict?: () => void) {
    setSaving(true);
    setError("");
    try {
      await action();
      after?.();
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && [404, 409].includes(err.status)) {
        if (err.status === 409) onConflict?.();
        await refresh();
      }
      setError(socialError(err));
    } finally {
      setSaving(false);
    }
  }

  function confirm(title: string, body: string, action: () => Promise<unknown>) {
    Alert.alert(title, body, [
      { text: "Go back", style: "cancel" },
      { text: title, style: "destructive", onPress: () => void mutate(action) },
    ]);
  }

  const membershipOpen = circle?.state === "OPEN" || circle?.state === "FULL";
  const activities = circle ? [...circle.activities].sort((a, b) => Number(b.id === activityId) - Number(a.id === activityId)) : [];
  return (
    <SocialScreen title={circle?.title ?? "Circle"} refresh={() => void refresh()} busy={loading}>
      {loading && !circle ? <Text>Loading circle…</Text> : null}
      {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
      {circle ? <>
        <SocialCard>
          <Text>{circle.description}</Text>
          <Text color="textSubdued">{CONNECTION_INTENT_LABELS[circle.intent]} · {circle.locality}</Text>
          <Text color="textSubdued">{circle.approvedCount}/{circle.capacity} members · {stateLabel(circle.state)}</Text>
          {circle.ownStatus ? <Text accessibilityLiveRegion="polite">Membership · {stateLabel(circle.ownStatus)}</Text> : null}
          {circle.state === "OPEN" && (!circle.ownStatus || circle.ownStatus === "WITHDRAWN") ? (
            <Button label="Request to join" disabled={saving} onPress={() => void mutate(() => socialApi.join(circle.id))} />
          ) : null}
          {circle.chatId ? <Button label="Open circle chat" variant="secondary" onPress={() => router.push({
            pathname: "/(app)/conversation/[conversationId]",
            params: { conversationId: circle.chatId! },
          })} /> : null}
          {circle.chatId ? <Text color="textSubdued">Chat history resets when the roster changes.</Text> : null}
          {!circle.chatId && circle.reportableOrganizerId ? (
            <Button label="Report organizer" variant="secondary" onPress={() => router.push({
              pathname: "/(app)/report",
              params: { targetType: "USER", reportedUserId: circle.reportableOrganizerId! },
            })} />
          ) : null}
          {!circle.organizer && active(circle.ownStatus ?? undefined) ? (
            <Button label={circle.ownStatus === "PENDING" ? "Withdraw membership request" : "Leave circle"} variant="secondary" disabled={saving}
              onPress={() => confirm(circle.ownStatus === "PENDING" ? "Withdraw request" : "Leave circle", "This also withdraws your active activity responses in this circle.", () => socialApi.leave(circle.id))} />
          ) : null}
          {circle.organizer && membershipOpen ? <>
            <Button label="Close circle" variant="secondary" disabled={saving} onPress={() => confirm("Close circle", "This ends the group chat and closes activities to participation.", () => socialApi.close(circle.id, false))} />
            <Button label="Cancel circle" variant="secondary" disabled={saving} onPress={() => confirm("Cancel circle", "This cancels the circle and ends group chat and activity participation.", () => socialApi.close(circle.id, true))} />
          </> : null}
        </SocialCard>
        {circle.members.length ? <SocialCard>
          <Text variant="titleSm" accessibilityRole="header">Members</Text>
          {circle.members.map((member) => (
            <View key={member.userId} style={{ gap: spacing.xs }}>
              <Text>{member.userId === user?.id ? "You" : member.name}</Text>
              {circle.organizer && member.userId !== user?.id ? <Button label={`Remove ${member.name}`} variant="secondary" disabled={saving}
                onPress={() => confirm("Remove member", "They will lose access to the group chat and their active activity responses.", () => socialApi.remove(circle.id, member.userId))} /> : null}
            </View>
          ))}
          {circle.chatId ? <Button label="Report or block a member" variant="secondary" onPress={() => router.push({
            pathname: "/(app)/conversation/[conversationId]",
            params: { conversationId: circle.chatId!, members: "1" },
          })} /> : null}
        </SocialCard> : null}
        {circle.requests.length ? <SocialCard>
          <Text variant="titleSm" accessibilityRole="header">Membership requests</Text>
          {circle.requests.map((request) => (
            <View key={request.userId} style={{ gap: spacing.sm }}>
              <Text>{request.name}</Text>
              <Button label={`Approve ${request.name}`} disabled={saving || circle.state === "FULL"} onPress={() => void mutate(() => socialApi.decide(circle.id, request.userId, true))} />
              <Button label={`Decline ${request.name}`} variant="secondary" disabled={saving} onPress={() => void mutate(() => socialApi.decide(circle.id, request.userId, false))} />
            </View>
          ))}
        </SocialCard> : null}
        <Text variant="titleSm" accessibilityRole="header">Activities</Text>
        {circle.organizer && membershipOpen ? <Button label={editing ? "Close activity form" : "Plan an activity"} variant="secondary"
          disabled={saving} onPress={() => setEditing(editing ? undefined : "new")} /> : null}
        {editing ? <ActivityForm key={editing === "new" ? "new" : `${editing.id}/${editing.version}`}
          activity={editing === "new" ? undefined : activities.find((item) => item.id === editing.id)}
          locality={circle.locality} saving={saving}
          onSave={(body, helpNeeds) => void mutate(
            () => editing === "new" ? socialApi.createActivity(circle.id, { ...body, helpNeeds })
              : socialApi.updateActivity(circle.id, editing.id, { ...body, version: editing.version }),
            () => setEditing(undefined),
            editing === "new" ? undefined : () => setEditing(undefined),
          )} /> : null}
        {circle.organizer && membershipOpen && circle.activities.some((activity) => activity.state === "UNAVAILABLE") ?
          <Button label="Recover unavailable participation" variant="secondary" disabled={saving}
            onPress={() => void mutate(() => socialApi.recover(circle.id))} /> : null}
        {!activities.length && !editing ? <Text color="textSubdued">No activities to show.</Text> : null}
        {activities.map((activity) => {
          const mine = new Map(activity.mine.map((response) => [response.need, response.status]));
          const open = activity.state === "OPEN" || activity.state === "FULL";
          if (activity.redacted) return (
            <ActivityReceipt key={activity.id} activity={activity} saving={saving}
              withdraw={(need) => void mutate(() => socialApi.respond(circle.id, activity.id, need, true))} />
          );
          return <SocialCard key={activity.id}>
            <Text variant="bodyStrong" accessibilityRole="header">{activity.title}</Text>
            <Text>{activity.description}</Text>
            <Text color="textSubdued">{activity.venue ? `${activity.venue.name} · ${activity.venue.publicLocality}` : circle.locality}</Text>
            <Text color="textSubdued">{activity.startsAt ? formatDateTime(activity.startsAt) : "Time to be decided"} · {stateLabel(activity.state)}</Text>
            <Text color="textSubdued">{activity.approvedCount}/{activity.capacity} attendance seats confirmed</Text>
            {["Attendance", ...activity.helpNeeds].map((label, need) => {
              const status = mine.get(need);
              const withdraw = open && active(status);
              const canRequest = circle.ownStatus !== "REMOVED" && open &&
                (need > 0 || activity.state !== "FULL") && (!status || status === "WITHDRAWN");
              return <View key={need} style={{ gap: spacing.xs }}>
                <Text>{label}{status ? ` · ${open ? "" : "Previous status · "}${stateLabel(status)}` : ""}</Text>
                {!circle.organizer && (withdraw || canRequest) ? (
                  <Button label={withdraw ? `Withdraw ${need === 0 ? "attendance" : label}` : need === 0 ? "Request a seat" : `Volunteer for ${label}`}
                    variant="secondary" disabled={saving}
                    onPress={() => void mutate(() => socialApi.respond(circle.id, activity.id, need, withdraw))} />
                ) : null}
              </View>;
            })}
            {circle.organizer && membershipOpen ? <>
              {open ? <Button label="Edit activity" variant="secondary" disabled={saving} onPress={() => setEditing(activity)} /> : null}
              {open ? <Button label="Cancel activity" variant="secondary" disabled={saving} onPress={() =>
                confirm("Cancel activity", "Participants will see that the activity was cancelled.", () => socialApi.cancelActivity(circle.id, activity.id))} /> : null}
              {open ? activity.requests.map((request) => (
                <View key={`${request.userId}:${request.need}`} style={{ gap: spacing.xs }}>
                  <Text>{request.name} · {request.need === 0 ? "Attendance" : activity.helpNeeds[request.need - 1]} · {stateLabel(request.status)}</Text>
                  {request.status === "PENDING" ? <>
                    <Button label={`Confirm ${request.name}`} disabled={saving || (request.need === 0 && activity.state === "FULL")}
                      onPress={() => void mutate(() => socialApi.decideActivity(circle.id, activity.id, request.need, request.userId, true))} />
                    <Button label={`Decline ${request.name}`} variant="secondary" disabled={saving}
                      onPress={() => void mutate(() => socialApi.decideActivity(circle.id, activity.id, request.need, request.userId, false))} />
                  </> : <Button label={`Remove ${request.name}`} variant="secondary" disabled={saving}
                    onPress={() => confirm("Remove participant", "This releases their confirmed participation.",
                      () => socialApi.decideActivity(circle.id, activity.id, request.need, request.userId, false))} />}
                </View>
              )) : null}
            </> : null}
          </SocialCard>;
        })}
      </> : null}
    </SocialScreen>
  );
}

type ActivityBody = Omit<Parameters<typeof socialApi.createActivity>[1], "helpNeeds">;

function ActivityForm({ activity, locality, saving, onSave }: {
  activity?: Activity;
  locality: string;
  saving: boolean;
  onSave: (body: ActivityBody, helpNeeds: string[]) => void;
}) {
  const initialTime = activity?.startsAt ? new Date(activity.startsAt) : null;
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [capacity, setCapacity] = useState(String(activity?.capacity ?? 4));
  const [openToNearby, setOpenToNearby] = useState(activity?.openToNearby ?? false);
  const [date, setDate] = useState(initialTime ? formatLocalDateValue(initialTime) : "");
  const [time, setTime] = useState(initialTime ? formatLocalTimeValue(initialTime) : "");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [helpNeeds, setHelpNeeds] = useState(["", "", ""]);
  const [venue, setVenue] = useState<Venue | null>(activity?.venue ?? null);
  const [venues, setVenues] = useState<Venue[]>();
  const [venueBusy, setVenueBusy] = useState(false);
  const [venueError, setVenueError] = useState(false);

  async function loadVenues() {
    setVenueBusy(true);
    setVenueError(false);
    try { setVenues((await socialApi.venues()).items); }
    catch { setVenueError(true); }
    finally { setVenueBusy(false); }
  }

  function save() {
    const result = date.trim() || time.trim() ? parseLocalDateTime(date, time) : { iso: null, error: null };
    setTimeError(result.error);
    if (result.error) return;
    onSave({ title: title.trim(), description: description.trim(), capacity: Number(capacity),
      openToNearby, startsAt: result.iso, venueId: venue?.id ?? null },
    [...new Set(helpNeeds.map((need) => need.trim()).filter(Boolean))]);
  }

  return <SocialCard>
    <Text variant="bodyStrong">{activity ? "Edit activity" : "New activity"}</Text>
    <Input label="Title" value={title} onChangeText={setTitle} maxLength={80} />
    <Input label="Description" helper="Keep contact details and private addresses out of your activity." value={description} onChangeText={setDescription} maxLength={500} multiline />
    <Input label="Attendance seats (1–6)" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" maxLength={1} />
    <Text color="textSubdued">Leave date and time blank to decide later.</Text>
    <DateTimeFields date={date} time={time} onDateChange={setDate} onTimeChange={setTime} disabled={saving} error={timeError} />
    <Text>{venue ? `${venue.name} · ${venue.publicLocality}` : `Locality · ${locality}`}</Text>
    {venue ? <Button label="Use locality only" variant="secondary" disabled={saving} onPress={() => setVenue(null)} /> : null}
    {venues ? venues.map((option) => <Button key={option.id} label={`${option.name} · ${option.publicLocality}`}
      variant={option.id === venue?.id ? "primary" : "secondary"} accessibilityState={{ selected: option.id === venue?.id }}
      disabled={saving} onPress={() => setVenue(option)} />) : (
      <Button label="Choose a reviewed venue" variant="secondary" disabled={saving} loading={venueBusy} onPress={() => void loadVenues()} />
    )}
    {venues?.length === 0 ? <Text color="textSubdued">No reviewed venues are available here.</Text> : null}
    {venueError ? <Text color="error" accessibilityRole="alert">Venues didn’t load. You can still use the locality.</Text> : null}
    <Button label={openToNearby ? "Visible to nearby people" : "Circle members only"} variant="secondary"
      accessibilityState={{ selected: openToNearby }} accessibilityHint="Changes who may request attendance"
      disabled={saving} onPress={() => setOpenToNearby(!openToNearby)} />
    {activity ? null : helpNeeds.map((need, index) => (
      <Input key={index} label={`Optional help need ${index + 1}`} value={need} maxLength={60}
        onChangeText={(value) => setHelpNeeds((previous) => previous.map((item, i) => i === index ? value : item))} />
    ))}
    <Button label="Save activity" loading={saving} disabled={!title.trim() || !description.trim() || !/^[1-6]$/.test(capacity)} onPress={save} />
  </SocialCard>;
}
