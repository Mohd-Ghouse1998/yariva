import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as NativeSplashScreen from "expo-splash-screen";
import React from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth/AuthContext";
import { ToastProvider } from "../src/components/ui/Toast";
import { BottomNavigationProvider } from "../src/components/navigation/bottomNavigation";
import { CallManagerProvider } from "../src/features/calls/CallManager";
import { RealtimeProvider } from "../src/realtime/RealtimeProvider";
import { ThemeProvider, useTheme } from "../src/theme/ThemeContext";
import { LocalizationProvider } from "../src/localization/LocalizationContext";

// Hold the native Yariva wordmark through font loading and the first app layout.
void NativeSplashScreen.preventAutoHideAsync().catch(() => undefined);

if (__DEV__) {
  // Expo Router selects the first configured scheme (yariva) deterministically. Keep the
  // legacy aroha scheme working without letting this development-only notice cover actions.
  LogBox.ignoreLogs(["Linking found multiple possible URI schemes in your Expo config."]);
}

function ThemedRoot({ fontsReady }: { fontsReady: boolean }) {
  const { palette, resolved } = useTheme();

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: palette.background }}
      onLayout={() => NativeSplashScreen.hide()}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <RealtimeProvider>
            <CallManagerProvider>
              <BottomNavigationProvider>
                <ToastProvider>
                  <StatusBar style={resolved === "dark" ? "light" : "dark"} />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: "fade",
                      contentStyle: { backgroundColor: palette.background },
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(onboarding)" />
                    <Stack.Screen name="(app)" />
                    <Stack.Screen
                      name="(call)"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="(modal)"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                  </Stack>
                </ToastProvider>
              </BottomNavigationProvider>
            </CallManagerProvider>
          </RealtimeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  return (
    <ThemeProvider>
      <LocalizationProvider>
        <ThemedRoot fontsReady={fontsLoaded || Boolean(fontError)} />
      </LocalizationProvider>
    </ThemeProvider>
  );
}
