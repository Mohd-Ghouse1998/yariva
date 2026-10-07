import React from "react";
import { View } from "react-native";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";

export const SafetyBadge: React.FC<{ label?: string }> = ({ label = "Public-place plan" }) => {
  const { palette } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.badge} accessible accessibilityLabel={label}>
      <Icon name="shield" size={15} color={palette.success} strokeWidth={2} />
      <Text variant="captionStrong" color="success">
        {label}
      </Text>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.successSubdued,
  },
}));
