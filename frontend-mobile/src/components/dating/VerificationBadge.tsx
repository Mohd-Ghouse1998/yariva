import React from "react";
import { StyleSheet, View } from "react-native";
import type { ProfileVerificationStatus } from "../../types/enums";
import { useTheme } from "../../theme/ThemeContext";
import { Icon } from "../ui/Icon";
import { Badge } from "../ui/Badge";

export const VerificationBadge: React.FC<{
  status: ProfileVerificationStatus;
  compact?: boolean;
}> = ({ status, compact = false }) => {
  const { palette } = useTheme();
  if (status !== "VERIFIED") return null;

  if (compact) {
    return (
      <View
        accessibilityLabel="Photo verified"
        style={[styles.compact, { backgroundColor: palette.success }]}
      >
        <Icon name="check" size={11} color={palette.alwaysWhite} />
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <View style={[styles.compact, { backgroundColor: palette.success }]}>
        <Icon name="check" size={11} color={palette.alwaysWhite} />
      </View>
      <Badge label="Photo verified" tone="success" />
    </View>
  );
};

const styles = StyleSheet.create({
  full: { flexDirection: "row", alignItems: "center", gap: 5 },
  compact: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
