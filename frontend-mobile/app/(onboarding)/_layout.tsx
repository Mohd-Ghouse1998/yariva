import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../src/theme/ThemeContext";

export default function OnboardingLayout() {
  const { palette } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="basic-info" />
      <Stack.Screen name="bio" />
      <Stack.Screen name="intent" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="lifestyle" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="discovery-preferences" />
      <Stack.Screen name="communication-preferences" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
