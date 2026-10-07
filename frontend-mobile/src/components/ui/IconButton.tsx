import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { controlSize } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";

// IconBtn from aroha_ui_deisgn_files/ui.jsx — circular pressable, 40px
// default, transparent / soft heartline / surface tones.
export interface IconButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  tone?: "plain" | "soft" | "surface" | "danger" | "brand" | "neutral" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onPress,
  children,
  size = 40,
  tone = "plain",
  disabled = false,
  style,
  accessibilityLabel,
}) => {
  const { palette } = useTheme();
  let bg: string;
  switch (tone) {
    case "plain":
    case "ghost":
      bg = palette.transparent;
      break;
    case "soft":
      bg = palette.brandSubdued;
      break;
    case "surface":
      bg = palette.surface;
      break;
    case "brand":
      bg = palette.brand;
      break;
    case "danger":
      bg = palette.error;
      break;
    case "neutral":
    default:
      bg = palette.surfaceSubdued;
      break;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.target,
        {
          width: Math.max(size, controlSize.minimumTouchTarget),
          height: Math.max(size, controlSize.minimumTouchTarget),
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.visual,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
          },
        ]}
      >
        {children}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  target: {
    alignItems: "center",
    justifyContent: "center",
  },
  visual: {
    alignItems: "center",
    justifyContent: "center",
  },
});
