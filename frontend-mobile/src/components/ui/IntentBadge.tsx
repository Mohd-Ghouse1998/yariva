import React from "react";
import { StyleSheet, View } from "react-native";
import type { ConnectionIntent } from "../../types/enums";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { type Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { CONNECTION_INTENT_LABELS } from "../../config/connectionIntents";

// Mirrors aroha_ui_deisgn_files/ui.jsx > IntentBadge — soft tinted pill
// with an inline icon. Used on discover cards and profile detail.
type Cfg = { iconName: IconName; color: string; bg: string };

const getConfig = (palette: Palette): Record<ConnectionIntent, Cfg> => ({
  DATING: {
    iconName: "heart",
    color: palette.brandDeep,
    bg: palette.brandSubdued,
  },
  COMMITTED_RELATIONSHIP: {
    iconName: "heartFill",
    color: palette.brandStrong,
    bg: palette.brandSubdued,
  },
  MARRIAGE_MINDED: {
    iconName: "spark",
    color: palette.success,
    bg: palette.successSubdued,
  },
  FRIENDSHIP: {
    iconName: "heart",
    color: palette.success,
    bg: palette.successSubdued,
  },
  COMPANIONSHIP: {
    iconName: "user",
    color: palette.textBrand,
    bg: palette.secondarySubdued,
  },
  SHARED_INTERESTS: {
    iconName: "spark",
    color: palette.premium,
    bg: palette.premiumSubdued,
  },
  RELATIONSHIP: {
    iconName: "heartFill",
    color: palette.brandStrong,
    bg: palette.brandSubdued,
  },
});

export interface IntentBadgeProps {
  intent: ConnectionIntent;
  size?: "sm" | "md";
}

export const IntentBadge: React.FC<IntentBadgeProps> = ({ intent, size = "md" }) => {
  const { palette } = useTheme();
  const cfg = getConfig(palette)[intent];
  const dims =
    size === "sm"
      ? { h: 22, padH: 8, fs: 12, ic: 12 }
      : { h: 28, padH: 10, fs: 12, ic: 14 };
  return (
    <View
      style={[
        styles.base,
        {
          minHeight: dims.h,
          paddingVertical: 2,
          paddingHorizontal: dims.padH,
          backgroundColor: cfg.bg,
        },
      ]}
    >
      <Icon name={cfg.iconName} size={dims.ic} color={cfg.color} strokeWidth={2} />
      <Text variant="captionStrong" style={{ color: cfg.color, fontSize: dims.fs }}>
        {CONNECTION_INTENT_LABELS[intent]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
  },
});
