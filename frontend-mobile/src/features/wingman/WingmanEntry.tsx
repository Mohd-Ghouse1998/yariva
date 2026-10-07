import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { wingmanApi } from "../../api/endpoints/wingman";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import type { WingmanStateDto } from "../../types/wingman";

export const WingmanEntry: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();
  const [state, setState] = useState<WingmanStateDto | null>(null);
  const [available, setAvailable] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([wingmanApi.capabilities(), wingmanApi.mine()])
        .then(([capabilities, next]) => {
          if (!active) return;
          setAvailable(capabilities.enabled);
          setState(next);
        })
        .catch(() => {
          if (active) setAvailable(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!available) return null;
  const title =
    state?.state === "ACTIVE"
      ? `Duo · ${state.party?.buddy?.displayName ?? "Connected"}`
      : state?.state === "PENDING"
        ? state.party?.invitation?.direction === "RECEIVED"
          ? "Duo invite waiting"
          : "Duo invite sent"
        : "Create your Duo";
  const subtitle =
    state?.state === "ACTIVE"
      ? state.party?.bothSceneConsented
        ? "Your duo is ready"
        : "Approve your Scenes together"
      : state?.state === "PENDING"
        ? "Open to review the private invite"
        : "Pair with one trusted friend";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={() => router.push("/(app)/wingman")}
      style={({ pressed }) => [styles.row, compact ? styles.compactRow : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.mark, compact ? styles.compactMark : null]}>
        <Icon name="user" filled size={18} color={palette.textOnBrand} />
        <View style={styles.spark}>
          <Icon name="sparkle" filled size={10} color={palette.premium} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text variant={compact ? "captionStrong" : "bodyStrong"} numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" color="textSubdued" numberOfLines={1}>
          {compact ? state?.state === "ACTIVE" ? state.party?.bothSceneConsented ? "Ready" : "Review Scenes" : state?.state === "PENDING" ? "Invitation" : "With a friend" : subtitle}
        </Text>
      </View>
      {!compact ? <Icon name="chevronRight" size={18} color={palette.textMuted} /> : null}
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.74 },
  compactRow: { flex: 1, minWidth: 0, minHeight: 56, gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  compactMark: { width: 28, height: 28 },
  mark: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.duoAccent,
  },
  spark: {
    position: "absolute",
    right: -2,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.premiumSubdued,
    borderWidth: 1,
    borderColor: palette.surface,
  },
  copy: { flex: 1, gap: spacing.xxs },
}));
