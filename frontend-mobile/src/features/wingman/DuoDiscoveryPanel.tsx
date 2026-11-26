import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { wingmanApi } from "../../api/endpoints/wingman";
import { ApiError } from "../../api/errors";
import { Avatar } from "../../components/ui/Avatar";
import { Button, ButtonRow } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import type {
  DuoCandidateDto,
  DuoDiscoveryMemberDto,
  DuoDiscoveryPageDto,
} from "../../types/wingman";

export const DuoDiscoveryPanel: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [page, setPage] = useState<DuoDiscoveryPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<"APPROVE" | "PASS" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPage(await wingmanApi.discover(undefined, 10));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Couldn’t load nearby Duos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vote = useCallback(
    async (candidate: DuoCandidateDto, decision: "APPROVE" | "PASS") => {
      if (voting) return;
      setVoting(decision);
      try {
        const result = await wingmanApi.vote(candidate.partyId, decision);
        if (result.match) {
          setPage({ items: [], nextCursor: null, waiting: { targetCount: 0, state: "NONE" }, match: result.match });
          toast.show("It’s a Duo match.", "success");
        } else {
          toast.show(decision === "APPROVE" ? "Private pick saved." : "Duo skipped.", "success");
          await load();
        }
      } catch (voteError) {
        const unavailable =
          voteError instanceof ApiError && voteError.code === "WINGMAN_TARGET_NOT_ELIGIBLE";
        toast.show(
          unavailable
            ? "That Duo is no longer available."
            : voteError instanceof ApiError
              ? voteError.message
              : "Couldn’t save your pick.",
          "error",
        );
        if (unavailable) await load();
      } finally {
        setVoting(null);
      }
    },
    [load, toast, voting],
  );

  if (loading && !page) {
    return (
      <View style={styles.loading} accessibilityLabel="Loading Duo discovery">
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <Card style={styles.centerCard}>
        <Icon name="wifi" size={21} color={palette.textMuted} />
        <Text variant="bodyStrong">Couldn’t load Duos</Text>
        <Button label="Try again" size="sm" variant="secondary" onPress={() => void load()} />
      </Card>
    );
  }

  if (page?.match) return <DuoMatch members={page.match.otherDuo.members} conversationId={page.match.conversationId} />;

  const candidate = page?.items[0];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <Icon name="sparkle" filled size={17} color={palette.premium} />
          <Text variant="subheading">Discover as a Duo</Text>
        </View>
        <View style={styles.privatePill}>
          <Icon name="lock" size={12} color={palette.textSubdued} />
          <Text variant="micro" color="textSubdued">Private picks</Text>
        </View>
      </View>

      {page && page.waiting.state !== "NONE" ? (
        <View style={styles.waitingLine}>
          <Icon name="clock" size={15} color={palette.textMuted} />
          <Text variant="caption" color="textSubdued">
            {page.waiting.state === "WAITING_FOR_YOUR_DUO"
              ? "Waiting for your friend’s pick"
              : "Your Duo agreed · waiting for them"}
          </Text>
        </View>
      ) : null}

      {candidate ? (
        <CandidateCard
          candidate={candidate}
          voting={voting}
          onVote={(decision) => void vote(candidate, decision)}
        />
      ) : (
        <Card style={styles.centerCard}>
          <View style={styles.emptyIcon}>
            <Icon name="compass" size={22} color={palette.premium} />
          </View>
          <Text variant="bodyStrong">No new Duos nearby</Text>
          <Text variant="caption" color="textSubdued" align="center">
            Check back when more pairs are active.
          </Text>
          <Button label="Refresh" size="sm" variant="secondary" onPress={() => void load()} />
        </Card>
      )}
    </View>
  );
};

const CandidateCard: React.FC<{
  candidate: DuoCandidateDto;
  voting: "APPROVE" | "PASS" | null;
  onVote: (decision: "APPROVE" | "PASS") => void;
}> = ({ candidate, voting, onVote }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <Card elevated style={styles.candidateCard}>
      <View style={styles.candidateTop}>
        <DuoAvatars members={candidate.members} />
        <View style={styles.candidateCopy}>
          <Text variant="heading" numberOfLines={1}>
            {candidate.members.map((member) => member.displayName).join(" & ")}
          </Text>
          {candidate.distance.roundedKm != null ? (
            <View style={styles.metaLine}>
              <Icon name="location" size={14} color={palette.textMuted} />
              <Text variant="caption" color="textSubdued">
                {candidate.distance.roundedKm === 0
                  ? "Very close"
                  : `${candidate.distance.roundedKm} km away`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.scenes}>
        {candidate.members.map((member) => (
          <View key={member.userId} style={styles.sceneRow}>
            <View style={styles.sceneDot} />
            <Text variant="bodyStrong" numberOfLines={1} style={styles.memberName}>
              {member.displayName}{member.age != null ? `, ${member.age}` : ""}
            </Text>
            <Text variant="body" color="textSubdued" numberOfLines={1} style={styles.activity}>
              {member.scene.activity}
            </Text>
          </View>
        ))}
      </View>

      <ButtonRow>
        <Button
          label="Pass"
          variant="secondary"
          disabled={Boolean(voting)}
          leftIcon={<Icon name="x" size={17} color={palette.textPrimary} />}
          onPress={() => onVote("PASS")}
        />
        <Button
          label="Interested"
          variant="like"
          loading={voting === "APPROVE"}
          disabled={voting === "PASS"}
          leftIcon={<Icon name="heart" filled size={17} color={palette.alwaysWhite} />}
          onPress={() => onVote("APPROVE")}
        />
      </ButtonRow>
    </Card>
  );
};

const DuoMatch: React.FC<{ members: DuoDiscoveryMemberDto[]; conversationId: string | null }> = ({ members, conversationId }) => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <Card style={styles.matchCard}>
      <View style={styles.matchIcon}>
        <Icon name="heart" filled size={20} color={palette.like} />
      </View>
      <DuoAvatars members={members} />
      <Text variant="heading" align="center">It’s a Duo match</Text>
      <Text variant="caption" color="textSubdued" align="center">
        You both chose {members.map((member) => member.displayName).join(" & ")}.
      </Text>
      {conversationId ? <Button label="Open Duo chat" size="sm" onPress={() => router.push({ pathname: "/(app)/conversation/[conversationId]", params: { conversationId } })} /> : null}
    </Card>
  );
};

const DuoAvatars: React.FC<{ members: DuoDiscoveryMemberDto[] }> = ({ members }) => {
  const styles = useStyles();
  return (
    <View style={styles.duoAvatars}>
      {members.slice(0, 2).map((member, index) => (
        <View key={member.userId} style={index === 1 ? styles.overlapAvatar : undefined}>
          <Avatar uri={member.photoUrl} initials={initials(member.displayName)} size={54} ring />
        </View>
      ))}
    </View>
  );
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "Y";

const useStyles = createThemeStyleHook((palette) => ({
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  privatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
  },
  loading: { minHeight: 132, alignItems: "center", justifyContent: "center" },
  waitingLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  candidateCard: { gap: spacing.md },
  candidateTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  candidateCopy: { flex: 1, gap: spacing.xs },
  metaLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  duoAvatars: { minWidth: 86, height: 56, flexDirection: "row", alignItems: "center" },
  overlapAvatar: { marginLeft: -22 },
  scenes: { gap: spacing.sm, paddingTop: spacing.xs },
  sceneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sceneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.premium },
  memberName: { maxWidth: "38%" },
  activity: { flex: 1 },
  centerCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.premiumSubdued,
  },
  matchCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    backgroundColor: palette.successSubdued,
  },
  matchIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
  },
}));
