import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../src/theme/ThemeContext";

export default function CallLayout() {
  const { palette } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.alwaysBlack },
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="incoming" />
      <Stack.Screen name="active" />
    </Stack>
  );
}
