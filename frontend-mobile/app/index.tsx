import { Redirect } from "expo-router";
import React from "react";
import { useAuth } from "../src/auth/AuthContext";
import { SplashScreen } from "../src/features/auth/SplashScreen";

export default function IndexRoute() {
  const { status, profileCompletion } = useAuth();

  // The native launch overlay has already held the brand through JS startup.
  // Keep this screen only while authentication is genuinely unresolved.
  if (status === "loading") return <SplashScreen />;
  if (status === "unauthenticated") return <Redirect href="/(auth)/login" />;
  if (profileCompletion && !profileCompletion.isComplete) {
    return <Redirect href="/(onboarding)" />;
  }
  return <Redirect href="/(app)/(tabs)/discover" />;
}
