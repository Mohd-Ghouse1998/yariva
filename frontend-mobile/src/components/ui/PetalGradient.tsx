import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

type PetalGradientProps = {
  children?: React.ReactNode;
  tone?: "accent" | "soft";
  style?: StyleProp<ViewStyle>;
};

/** Shared warm brand blends for action and quiet-surface treatments. */
export const PetalGradient: React.FC<PetalGradientProps> = ({
  children,
  tone = "accent",
  style,
}) => {
  const { palette } = useTheme();
  const colors: [string, string] = tone === "soft"
    ? [palette.blendSoftStart, palette.blendSoftEnd]
    : [palette.ctaStart, palette.ctaEnd];

  return (
    <LinearGradient
      pointerEvents={children ? undefined : "none"}
      colors={colors}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
};
