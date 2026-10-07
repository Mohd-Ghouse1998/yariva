import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createThemeStyleHook } from "../../theme/ThemeContext";
import { spacing } from "../../theme/spacing";

export const ResponsiveBottomAction: React.FC<{
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}> = ({ primary, secondary }) => {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stacked = width < 350;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
        stacked ? styles.stacked : null,
      ]}
    >
      {secondary ? <View style={styles.secondary}>{secondary}</View> : null}
      <View style={styles.primary}>{primary}</View>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  stacked: {
    flexDirection: "column-reverse",
    alignItems: "stretch",
  },
  secondary: {
    flex: 0.8,
    minWidth: 0,
  },
  primary: {
    flex: 1.2,
    minWidth: 0,
  },
}));
