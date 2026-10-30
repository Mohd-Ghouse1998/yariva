import React from "react";
import { Image, Pressable, View } from "react-native";
import type { DatePlanDto } from "../../types/datePlan";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { formatDateTime } from "../../utils/format";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { planHasElapsed, planNeedsEventReview, planStatusLabel } from "../../features/datePlans/planPresentation";

const STATUS: Record<
  DatePlanDto["status"],
  { label: string; tone: "brand" | "success" | "warning" | "error" | "neutral" }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PROPOSED: { label: "Reply needed", tone: "warning" },
  COUNTERED: { label: "Updated", tone: "brand" },
  ACCEPTED: { label: "Confirmed", tone: "success" },
  DECLINED: { label: "Declined", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "error" },
  COMPLETED: { label: "Done", tone: "success" },
};

export const DatePlanCard: React.FC<{
  plan: DatePlanDto;
  onPress: () => void;
  personName?: string;
  personPhoto?: string | null;
  viewerUserId?: string;
  now?: number;
}> = ({ plan, onPress, personName, personPhoto, viewerUserId, now = Date.now() }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const { t } = useLocalization();
  const status = STATUS[plan.status];
  const needsReview = planNeedsEventReview({ ...plan, startAt: plan.proposedStartAt }, now);
  const waitingForReply =
    !needsReview &&
    plan.status === "PROPOSED" &&
    !planHasElapsed({ ...plan, startAt: plan.proposedStartAt }, now) &&
    viewerUserId === plan.createdByUserId;
  const place = plan.venueName ?? plan.publicLocality;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open meetup: ${plan.title}`}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID="compact-meetup-card"
    >
      {personPhoto ? (
        <Image source={{ uri: personPhoto }} style={styles.photo} accessibilityLabel={personName ? `${personName}'s photo` : "Connection photo"} />
      ) : (
        <View style={styles.iconTile}>
          <Icon name="calendar" size={19} color={palette.brandStrong} />
        </View>
      )}
      <View style={styles.copy}>
        <Text variant="bodyStrong" numberOfLines={1}>{plan.title}</Text>
        <Text variant="caption" color="textSubdued" numberOfLines={1}>{formatDateTime(plan.proposedStartAt)}</Text>
        <View style={styles.placeLine}>
          <Icon name="location" size={13} color={palette.textMuted} />
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.title}>
            {place}
          </Text>
        </View>
        <View style={styles.bottomLine}>
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.title}>
            {personName ? `With ${personName}` : "Meetup plan"}
          </Text>
          <Badge label={waitingForReply ? "Waiting" : planStatusLabel({ ...plan, startAt: plan.proposedStartAt }, now, t)} tone={needsReview ? "warning" : waitingForReply ? "neutral" : status.tone} />
        </View>
      </View>
      <Icon name="chevronRight" size={17} color={palette.textMuted} />
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  row: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  iconTile: {
    width: 52,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  photo: { width: 52, height: 60, borderRadius: radius.sm, backgroundColor: palette.surfaceMuted },
  pressed: {
    opacity: 0.72,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  bottomLine: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { flex: 1, minWidth: 0 },
  placeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
}));
