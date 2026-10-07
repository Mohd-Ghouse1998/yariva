import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle } from "react-native";
import type { Palette } from "../../theme/colors";
import { radius } from "../../theme/spacing";
import { createThemeStyleHook } from "../../theme/ThemeContext";

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  borderRadius: br = radius.sm,
  style,
}) => {
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: br, opacity },
        style,
      ]}
    />
  );
};

export const SkeletonRow: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 8 }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap }}>{children}</View>
);

const useStyles = createThemeStyleHook((palette: Palette) => ({
  base: {
    backgroundColor: palette.surfaceSubdued,
  },
}));
