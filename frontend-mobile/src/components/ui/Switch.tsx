import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { radius } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  accessibilityLabel?: string;
  accessible?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled,
  size = "md",
  accessibilityLabel,
  accessible = true,
}) => {
  const { palette } = useTheme();
  const trackWidth = size === "sm" ? 36 : 48;
  const trackHeight = size === "sm" ? 22 : 28;
  const thumb = trackHeight - 6;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      accessible={accessible}
      pointerEvents={accessible ? "auto" : "none"}
      disabled={disabled}
      onPress={() => !disabled && onValueChange(!value)}
      style={[styles.target, { width: Math.max(trackWidth, 44), opacity: disabled ? 0.5 : 1 }]}
    >
      <View
        style={[
          styles.track,
          {
            width: trackWidth,
            height: trackHeight,
            backgroundColor: value ? palette.brand : palette.borderStrong,
          },
        ]}
      >
        <View
          style={[
            styles.thumb,
            {
              width: thumb,
              height: thumb,
              borderRadius: thumb / 2,
              backgroundColor: palette.alwaysWhite,
              shadowColor: palette.alwaysBlack,
              transform: [{ translateX: value ? trackWidth - thumb - 3 : 3 }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  target: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  thumb: {
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
});
