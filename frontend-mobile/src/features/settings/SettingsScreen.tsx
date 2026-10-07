import { useRouter, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmLogoutSheet } from "../../components/auth/ConfirmLogoutSheet";
import { Header } from "../../components/layout/Header";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { useLocalization } from "../../localization/LocalizationContext";

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/profile");
  const { logout } = useAuth();
  const { mode, palette } = useTheme();
  const responsive = useResponsiveLayout();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { language, tone, t } = useLocalization();
  const appearanceLabel = mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light";

  const handleLogout = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      setLogoutOpen(false);
    } finally {
      setSigningOut(false);
    }
  }, [logout, signingOut]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
        <Header title="Settings" showBack onLeftPress={goBack} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              maxWidth: responsive.contentMaxWidth,
              paddingHorizontal: responsive.screenPadding,
            },
          ]}
        >
          <NavigationListSection label="ACCOUNT">
            <NavigationListRow
              first
              icon="device"
              label="Devices & sessions"
              onPress={() => router.push("/(app)/settings/sessions")}
            />
          </NavigationListSection>

          <NavigationListSection label="APPEARANCE">
            <NavigationListRow
              first
              icon="eye"
              label="Theme"
              meta="Light, Dark, or System"
              value={appearanceLabel}
              onPress={() => router.push("/(app)/settings/appearance")}
            />
            <NavigationListRow
              icon="globe"
              label={t("settings.language.title")}
              meta={t("settings.language.meta")}
              value={`${language.toUpperCase()}${tone === "hyderabad-casual" ? " · HYD" : ""}`}
              onPress={() => router.push("/(app)/settings/language" as Href)}
            />
          </NavigationListSection>

          <NavigationListSection label="PRIVACY">
            <NavigationListRow
              first
              icon="eye"
              label="Privacy"
              meta="Hide age, distance, pause"
              onPress={() => router.push("/(app)/settings/privacy")}
            />
            <NavigationListRow
              icon="chat"
              label="Communication"
              meta="Calls, read receipts, media"
              onPress={() => router.push("/(app)/settings/communication")}
            />
          </NavigationListSection>

          <NavigationListSection label="SAFETY">
            <NavigationListRow
              first
              icon="block"
              label="Blocked users"
              onPress={() => router.push("/(app)/settings/blocked")}
            />
          </NavigationListSection>

          <NavigationListSection>
            <NavigationListRow
              first
              icon="logout"
              label="Log out"
              meta="Sign out on this device"
              onPress={() => setLogoutOpen(true)}
            />
          </NavigationListSection>
        </ScrollView>
      </SafeAreaView>

      <ConfirmLogoutSheet
        visible={logoutOpen}
        busy={signingOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void handleLogout()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    width: "100%",
    alignSelf: "center",
    gap: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
});
