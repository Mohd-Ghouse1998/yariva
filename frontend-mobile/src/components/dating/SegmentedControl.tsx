import React from "react";
import { Pressable, View } from "react-native";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook } from "../../theme/ThemeContext";
import { Text } from "../ui/Text";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  disabled = false,
  variant = "filled",
}: {
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: "filled" | "underline";
}) {
  const styles = useStyles();
  const underline = variant === "underline";
  return (
    <View style={[styles.wrap, underline ? styles.underlineWrap : null]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${option.label}${option.count === undefined ? "" : `, ${option.count}`}`}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.segment,
              underline ? styles.underlineSegment : null,
              selected ? (underline ? styles.underlineSelected : styles.selected) : null,
              disabled ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text variant="captionStrong" numberOfLines={2} align="center" color={selected ? (underline ? "brandStrong" : "textInverse") : "textSecondary"}>
              {option.label}
              {option.count === undefined ? "" : ` ${option.count}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createThemeStyleHook((palette) => ({
  wrap: {
    minHeight: controlSize.minimumTouchTarget + spacing.xs * 2,
    flexDirection: "row",
    padding: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  underlineWrap: {
    minHeight: controlSize.minimumTouchTarget,
    padding: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: palette.divider,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  segment: {
    flex: 1,
    minHeight: controlSize.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
  },
  selected: {
    backgroundColor: palette.surfaceInverse,
  },
  underlineSegment: {
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  underlineSelected: {
    borderBottomColor: palette.brandStrong,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
}));
