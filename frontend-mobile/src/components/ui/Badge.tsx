import React from "react";
import { StyleSheet, View } from "react-native";
import type { Palette } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { Text } from "./Text";

export interface BadgeProps {
  label: string;
  tone?: "brand" | "neutral" | "success" | "warning" | "error";
}

export const Badge: React.FC<BadgeProps> = ({ label, tone = "brand" }) => {
  const { palette } = useTheme();
  const tones: Record<
    NonNullable<BadgeProps["tone"]>,
    { bg: string; color: keyof Palette }
  > = {
    brand: { bg: palette.brandSubdued, color: "textBrand" },
    neutral: { bg: palette.surfaceSubdued, color: "textSecondary" },
    success: { bg: palette.successSubdued, color: "success" },
    warning: { bg: palette.warningSubdued, color: "warning" },
    error: { bg: palette.errorSubdued, color: "error" },
  };
  const t = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text variant="micro" color={t.color} weight="600">
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
});
