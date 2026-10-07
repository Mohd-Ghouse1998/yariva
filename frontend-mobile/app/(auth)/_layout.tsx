import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "../../src/theme/ThemeContext";

export default function AuthLayout() {
  const { palette } = useTheme();
  return (
    <Stack
      initialRouteName="login"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
