import React from "react";
import { View } from "react-native";
import type { PublicProfileDto } from "../../types/profile";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { uniqueCompatibilityReasons } from "./compatibilityReasons";

export const CompatibilitySummary: React.FC<{
  compatibility: PublicProfileDto["compatibility"];
  compact?: boolean;
}> = ({ compatibility, compact = false }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const reasons = uniqueCompatibilityReasons(
    compatibility.reasons,
    compatibility.scheduleOverlap,
  ).slice(0, compact ? 1 : 3);

  return (
    <View style={[styles.container, compact ? styles.compact : null]}>
      <View style={[styles.headingRow, compact ? styles.headingRowCompact : null]}>
        <View style={styles.score}>
          <Icon name="spark" size={15} color={palette.brandStrong} strokeWidth={2} />
          <Text variant="captionStrong" color="textBrand">
            {compatibility.score}% fit
          </Text>
        </View>
        {compatibility.scheduleOverlap ? (
          <Text
            variant="caption"
            color="textSubdued"
            numberOfLines={compact ? 2 : undefined}
            style={[styles.schedule, compact ? styles.scheduleCompact : null]}
          >
            {compatibility.scheduleOverlap}
          </Text>
        ) : null}
      </View>
      {reasons.map((reason) => (
        <View key={reason} style={styles.reasonRow}>
          <View style={styles.dot} />
          <Text variant="caption" color="textSecondary" style={styles.reasonText}>
            {reason}
          </Text>
        </View>
      ))}
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.brandSubdued,
    borderWidth: 1,
    borderColor: palette.brandTint,
  },
  compact: {
    paddingVertical: spacing.sm,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headingRowCompact: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  score: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  schedule: {
    flexShrink: 1,
    textAlign: "right",
  },
  scheduleCompact: {
    flexBasis: "100%",
    textAlign: "left",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    marginTop: 6,
    borderRadius: radius.pill,
    backgroundColor: palette.brand,
  },
  reasonText: {
    flex: 1,
  },
}));
