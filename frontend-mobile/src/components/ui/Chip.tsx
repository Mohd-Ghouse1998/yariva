import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import { Text } from "./Text";
import { PetalGradient } from "./PetalGradient";
import { controlSize } from "../../theme/spacing";

// Chip from aroha_ui_deisgn_files/ui.jsx:
//   md: { h: 36, px: 14, fs: 13 }
//   sm: { h: 28, px: 10, fs: 12 }
//   selected → brand surface / accessible textOnBrand / brand border
//   tone "soft" → brandSubdued / textBrand / brandTint
//   default → bg surface / color text / border borderStrong
export interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  size?: "sm" | "md";
  tone?: "default" | "soft" | "neutral" | "brand" | "warning" | "success";
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  disabled = false,
  onPress,
  leadingIcon,
  trailingIcon,
  size = "md",
  tone = "default",
}) => {
  const { palette } = useTheme();
  const sz = size === "sm" ? { h: 28, px: 10, fs: 12 } : { h: 36, px: 14, fs: 13 };

  let backgroundColor: string;
  let borderColor: string;
  let textColor: keyof Palette;

  if (selected) {
    backgroundColor = palette.brandSubdued;
    borderColor = palette.brandBorder;
    textColor = "textBrand";
  } else if (tone === "soft" || tone === "brand") {
    backgroundColor = palette.brandSubdued;
    borderColor = palette.brandTint;
    textColor = "textBrand";
  } else if (tone === "warning") {
    backgroundColor = palette.warningSubdued;
    borderColor = palette.warningSubdued;
    textColor = "warning";
  } else if (tone === "success") {
    backgroundColor = palette.successSubdued;
    borderColor = palette.successSubdued;
    textColor = "success";
  } else {
    backgroundColor = palette.surface;
    borderColor = palette.borderStrong;
    textColor = "textPrimary";
  }

  const visual = (
    <View
      pointerEvents="none"
      style={[
        styles.base,
        {
          minHeight: sz.h,
          paddingHorizontal: sz.px,
          backgroundColor,
          borderColor,
        },
        disabled && styles.disabled,
      ]}
    >
      {selected ? <PetalGradient tone="soft" style={styles.selectedBlend} /> : null}
      {leadingIcon ? <View style={{ marginRight: 6 }}>{leadingIcon}</View> : null}
      <Text variant="captionStrong" weight="500" color={textColor} style={{ fontSize: sz.fs }}>
        {label}
      </Text>
      {trailingIcon ? <View style={{ marginLeft: 6 }}>{trailingIcon}</View> : null}
    </View>
  );

  if (!onPress) return visual;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.hitTarget, pressed ? styles.pressed : null]}
    >
      {visual}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  selectedBlend: {
    ...StyleSheet.absoluteFill,
  },
  hitTarget: {
    minHeight: controlSize.minimumTouchTarget,
    minWidth: controlSize.minimumTouchTarget,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.55,
  },
});
