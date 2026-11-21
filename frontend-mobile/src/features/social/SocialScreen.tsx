import React from "react";
import { useRouter } from "expo-router";
import { RefreshControl, View } from "react-native";
import { Screen } from "../../components/layout/Screen";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { ApiError } from "../../api/errors";

export function SocialScreen({ title, refresh, busy, children }: {
  title: string; refresh?: () => void; busy?: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const { palette } = useTheme();
  return (
    <Screen scroll keyboardAvoiding contentStyle={{ gap: spacing.lg }} scrollProps={{
      refreshControl: refresh ? <RefreshControl refreshing={!!busy} onRefresh={refresh} tintColor={palette.brandStrong} /> : undefined,
    }}>
      <Button label="Back" variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)/discover")} style={{ alignSelf: "flex-start" }} />
      <Text variant="title" accessibilityRole="header">{title}</Text>
      {children}
    </Screen>
  );
}

export function SocialCard({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, backgroundColor: palette.surface }}>
      {children}
    </View>
  );
}

export function socialError(error: unknown) {
  if (error instanceof ApiError && error.status === 404) return "This is no longer available.";
  if (error instanceof ApiError && error.status === 409) return error.message;
  return "Something went wrong. Pull to refresh and try again.";
}
