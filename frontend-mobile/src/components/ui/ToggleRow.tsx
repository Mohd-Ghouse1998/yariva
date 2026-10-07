import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Switch } from "./Switch";
import { Text } from "./Text";
import { spacing } from "../../theme/spacing";

// ToggleRow from aroha_ui_deisgn_files/profile-setup.jsx — used by privacy /
// communication / schedule / discovery prefs. White surface card, 1px border,
// label + optional sub on the left, switch on the right.
export interface ToggleRowProps {
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  grouped?: boolean;
  first?: boolean;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  sub,
  value,
  onValueChange,
  disabled = false,
  style,
  grouped = false,
  first = false,
}) => {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={sub}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[
        styles.wrap,
        { backgroundColor: palette.surface, borderColor: palette.border },
        grouped && {
          borderWidth: 0,
          borderRadius: 0,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2,
          borderTopColor: palette.divider,
          minHeight: 58,
          paddingHorizontal: 13,
          paddingVertical: spacing.sm,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text variant="bodyStrong" style={{ fontSize: 14, lineHeight: 18 }}>
          {label}
        </Text>
        {sub ? (
          <Text
            variant="caption"
            color="textSubdued"
            style={{ marginTop: 2, fontSize: 12.5, lineHeight: 17 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} accessible={false} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.55,
  },
});
