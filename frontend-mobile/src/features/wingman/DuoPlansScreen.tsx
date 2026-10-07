import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Linking, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { conversationsApi } from "../../api/endpoints/conversations";
import { duoPlansApi, type DuoPlan } from "../../api/endpoints/duoPlans";
import { useAuth } from "../../auth/AuthContext";
import { Header } from "../../components/layout/Header";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { layout, spacing } from "../../theme/spacing";
import type { ConversationDetailDto } from "../../types/conversation";
import { formatDateTime } from "../../utils/format";
import { buildGoogleMapsPlaceUrl } from "../datePlans/datePlanLogic";
import { planHasElapsed, planStatusLabel } from "../datePlans/planPresentation";
import { useCurrentTime } from "../../hooks/useCurrentTime";

const isOpen = (plan: DuoPlan) => ["PROPOSED", "COUNTERED", "ACCEPTED"].includes(plan.status);
export const DuoPlansScreen: React.FC = () => {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/chats");
  const { user } = useAuth();
  const realtime = useRealtime();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useStyles();
  const now = useCurrentTime();
  const [plans, setPlans] = useState<DuoPlan[]>([]);
  const [group, setGroup] = useState<ConversationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelPlan, setCancelPlan] = useState<DuoPlan | null>(null);
  const load = useCallback(async () => {
    try {
      const [conversation, page] = await Promise.all([
        conversationsApi.get(conversationId),
        duoPlansApi.list(conversationId),
      ]);
      setGroup(conversation);
      setPlans(page.items);
      setError(false);
    } catch {
      setGroup(null);
      setPlans([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(
    () =>
      realtime.socket.on<{ conversationId: string }>("duo.plan.updated", (event) => {
        if (event.conversationId === conversationId) void load();
      }),
    [conversationId, load, realtime],
  );
  useEffect(
    () =>
      realtime.onConversationClosed((event) => {
        if (event.conversationId === conversationId) {
          setPlans([]);
          setGroup(null);
          setError(true);
        }
      }),
    [conversationId, realtime],
  );
  useEffect(() => {
    if (realtime.status === "connected") void load();
  }, [load, realtime.status]);
  const propose = (plan?: DuoPlan) =>
    router.push({
      pathname: "/(app)/date-plan/new",
      params: {
        conversationId,
        ...(plan ? { counterPlanId: plan.id, expectedVersion: String(plan.version) } : {}),
      },
    });
  const respond = async (plan: DuoPlan, action: "ACCEPT" | "DECLINE" | "CANCEL") => {
    if (busy) return;
    setBusy(true);
    try {
      await duoPlansApi.respond(plan.id, plan.version, action);
      setCancelPlan(null);
      await load();
    } catch {
      toast.show("This plan changed or is unavailable. Please review it again.", "error");
      await load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <Header title="Duo meetup" showBack onLeftPress={goBack} />
      {loading ? (
        <Text style={styles.padding}>Loading meetup…</Text>
      ) : error ? (
        <EmptyState
          title="Meetup unavailable"
          body="Reconnect or return to your chats."
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(plan) => plan.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text variant="caption" color="textSubdued">
                A place and time for your Duo group.
              </Text>
              {!plans.some(isOpen) ? (
                <Button label="Suggest a meetup" size="sm" onPress={() => propose()} />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Text variant="body" color="textSubdued">
              No Duo meetup planned yet.
            </Text>
          }
          renderItem={({ item: plan }) => (
            <Card style={styles.planCard}>
              <View style={styles.groupRow}>
                <View style={styles.avatarRow}>
                  {group?.participants.slice(0, 4).map((member) => (
                    <View key={member.userId} style={styles.avatarWrap}>
                      <Avatar
                        uri={member.photos.find((photo) => photo.isPrimary)?.url ?? member.photos[0]?.url}
                        initials={member.displayName}
                        size={38}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.statusPill}>
                  <Text
                    variant="captionStrong"
                    color={plan.status === "ACCEPTED" ? "success" : "textSubdued"}
                  >
                    {planStatusLabel(plan, now)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardHeading}>
                <Text variant="subheading" style={styles.headingText}>
                  {plan.venueName}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="sparkle" size={16} color={palette.brandStrong} />
                <Text variant="caption" color="textSubdued" style={styles.headingText}>
                  {plan.activity}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="calendar" size={16} color={palette.brandStrong} />
                <Text variant="bodyStrong" style={styles.headingText}>
                  {formatDateTime(plan.startAt)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="location" size={16} color={palette.brandStrong} />
                <Text variant="caption" color="textSubdued" style={styles.headingText}>
                  {plan.publicLocality}
                </Text>
              </View>
              {isOpen(plan) ? (
                <>
                  <View style={styles.attendanceRow}>
                    <Text variant="captionStrong" color="success">
                      {plan.acceptedUserIds.length} going
                    </Text>
                    <Text variant="captionStrong" color="textSubdued">
                      {Math.max(0, plan.participantCount - plan.acceptedUserIds.length)} pending
                    </Text>
                  </View>
                  <View style={styles.wrap}>
                    {group?.participants.map((member) => (
                      <View key={member.userId} style={styles.personChip}>
                        <Text
                          variant="caption"
                          color={
                            plan.acceptedUserIds.includes(member.userId) ? "success" : "textSubdued"
                          }
                        >
                          {member.displayName}
                          {plan.acceptedUserIds.includes(member.userId) ? " ✓" : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {!planHasElapsed(plan, now) && !plan.acceptedUserIds.includes(user?.id ?? "") ? (
                    <Button
                      label="I’m in"
                      size="sm"
                      loading={busy}
                      onPress={() => void respond(plan, "ACCEPT")}
                    />
                  ) : null}
                  <View style={styles.wrap}>
                    <Button
                      label="Change"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onPress={() => propose(plan)}
                    />
                    <Button
                      label={
                        plan.acceptedUserIds.includes(user?.id ?? "")
                          ? "Cancel plan"
                          : "Can’t make it"
                      }
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onPress={() => setCancelPlan(plan)}
                    />
                  </View>
                </>
              ) : null}
              <Button
                label="Open in Maps"
                variant="ghost"
                size="sm"
                onPress={() =>
                  void Linking.openURL(
                    buildGoogleMapsPlaceUrl(plan.venueName, plan.publicLocality),
                  ).catch(() => toast.show("Maps couldn’t open.", "error"))
                }
              />
            </Card>
          )}
        />
      )}
      <CenterDialog
        visible={Boolean(cancelPlan)}
        onClose={() => setCancelPlan(null)}
        accessibilityLabel="Cancel Duo meetup"
      >
        <Text variant="subheading">Cancel for everyone?</Text>
        <Button
          label="Cancel meetup"
          variant="danger"
          loading={busy}
          onPress={() => cancelPlan && void respond(cancelPlan, "CANCEL")}
        />
        <Button label="Keep plan" variant="ghost" onPress={() => setCancelPlan(null)} />
      </CenterDialog>
    </SafeAreaView>
  );
};
const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  padding: { padding: spacing.lg },
  content: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  intro: { gap: spacing.md, paddingBottom: spacing.xs },
  planCard: { gap: spacing.sm, borderColor: palette.border, backgroundColor: palette.surface },
  groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  avatarRow: { flexDirection: "row", alignItems: "center", paddingLeft: spacing.xs },
  avatarWrap: { marginLeft: -spacing.xs, borderWidth: 2, borderColor: palette.surface, borderRadius: 24 },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headingText: { flex: 1 },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 100,
    backgroundColor: palette.surfaceMuted,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  attendanceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  personChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 100,
    backgroundColor: palette.surfaceMuted,
  },
}));
