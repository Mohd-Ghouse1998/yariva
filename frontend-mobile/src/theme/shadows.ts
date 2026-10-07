import type { ViewStyle } from "react-native";

// Elevation is intentionally rare in the editorial system. Lists use spacing
// and dividers rather than cards with persistent shadows.
const sm: ViewStyle = {
  shadowColor: "#211F20",
  shadowOpacity: 0.05,
  shadowOffset: { width: 0, height: 1 },
  shadowRadius: 2,
  elevation: 0,
};
const md: ViewStyle = {
  shadowColor: "#211F20",
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
  elevation: 2,
};
const lg: ViewStyle = {
  shadowColor: "#211F20",
  shadowOpacity: 0.12,
  shadowOffset: { width: 0, height: 18 },
  shadowRadius: 28,
  elevation: 5,
};
// A restrained warm brand glow for high-value actions.
const glow: ViewStyle = {
  shadowColor: "#A74835",
  shadowOpacity: 0.12,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 16,
  elevation: 6,
};

export const shadows = {
  sm,
  md,
  lg,
  glow,
  // Aliases kept for backwards compatibility with earlier components.
  low: sm,
  medium: md,
  high: lg,
};

export type ShadowToken = keyof typeof shadows;
