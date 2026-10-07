import { Redirect, Stack } from "expo-router";
import React from "react";
import { useAuth } from "../../src/auth/AuthContext";
import { AccountRestrictedScreen } from "../../src/features/errors/AccountRestrictedScreen";
import { SplashScreen } from "../../src/features/auth/SplashScreen";
import { useTheme } from "../../src/theme/ThemeContext";
import { PushRegistrationEffect } from "../../src/notifications/PushRegistrationEffect";

export default function AppLayout() {
  const { status, user, profileCompletion } = useAuth();
  const { palette } = useTheme();

  if (status === "loading") return <SplashScreen />;
  if (status === "unauthenticated") return <Redirect href="/(auth)/welcome" />;
  if (profileCompletion && !profileCompletion.isComplete) {
    return <Redirect href="/(onboarding)" />;
  }
  if (user && user.status !== "ACTIVE") {
    return <AccountRestrictedScreen status={user.status} />;
  }

  return (
    <>
      <PushRegistrationEffect />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vibe" />
        <Stack.Screen name="private-stories/index" />
        <Stack.Screen name="private-stories/follows" />
        <Stack.Screen name="private-stories/community" />
        <Stack.Screen name="wingman/index" />
        <Stack.Screen name="wingman/invite/[token]" />
        <Stack.Screen name="profile/[userId]" />
        <Stack.Screen name="match/[matchId]" />
        <Stack.Screen name="conversation/[conversationId]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="date-plan/new" />
        <Stack.Screen name="date-plan/[datePlanId]" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/privacy" />
        <Stack.Screen name="settings/communication" />
        <Stack.Screen name="settings/sessions" />
        <Stack.Screen name="settings/blocked" />
        <Stack.Screen name="settings/edit-profile" />
        <Stack.Screen name="settings/appearance" />
        <Stack.Screen name="settings/language" />
        <Stack.Screen name="report" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
