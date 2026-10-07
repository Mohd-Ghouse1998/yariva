import { useRouter } from "expo-router";
import React from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArohaWordmark } from "../../components/ui/ArohaMark";
import { Button } from "../../components/ui/Button";
import { PetalBackdrop } from "../../components/ui/PetalBackdrop";
import { Text } from "../../components/ui/Text";
import { useResponsiveLayout } from "../../theme/responsive";
import { shadows } from "../../theme/shadows";
import { useTheme } from "../../theme/ThemeContext";

// ScreenWelcome from aroha_ui_deisgn_files/auth.jsx — soft warm wash, the
// approved Yariva wordmark, three layered portrait cards, Space Grotesk hero copy,
// then primary + ghost CTAs and a tiny terms line.
const HERO_CARDS = [
  {
    rot: -8,
    x: -56,
    y: 30,
    name: "Asha",
    uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&w=600&q=80",
  },
  {
    rot: 6,
    x: 56,
    y: 50,
    name: "Rohan",
    uri: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&w=600&q=80",
  },
  {
    rot: -2,
    x: 0,
    y: 0,
    name: "Ira",
    uri: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&w=600&q=80",
  },
];

export const WelcomeScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <PetalBackdrop variant="welcome" />
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroWrap}>
            <ArohaWordmark size={38} />
            <View style={styles.heroStack}>
              {HERO_CARDS.map((c, i) => (
                <View
                  key={i}
                  style={[
                    styles.heroCard,
                    shadows.lg,
                    {
                      top: c.y,
                      borderColor: palette.alwaysWhite,
                      backgroundColor: palette.surfaceSubdued,
                      transform: [{ translateX: c.x }, { rotate: `${c.rot}deg` }],
                    },
                  ]}
                >
                  <Image source={{ uri: c.uri }} style={styles.heroImage} />
                  <View style={[styles.heroNameWrap, { backgroundColor: palette.inkAlpha55 }]}>
                    <Text variant="captionStrong" color="textInverse">
                      {c.name}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View
            style={[
              styles.bottom,
              {
                width: "100%",
                maxWidth: responsive.actionMaxWidth,
                paddingHorizontal: responsive.screenPadding,
                paddingBottom: Math.max(insets.bottom, 32),
              },
            ]}
          >
            <Text variant="authTitle" align="center" accessibilityRole="header">
              Date with clarity. Meet with confidence.
            </Text>
            <Text variant="bodyLarge" color="textSubdued" align="center" style={{ marginTop: 12 }}>
              India-first intentional dating, thoughtful matches, and safer plans for meeting in
              real life.
            </Text>
            <View style={{ marginTop: 28, gap: 10 }}>
              <Button
                label="Create account"
                variant="primary"
                fullWidth
                onPress={() => router.push("/(auth)/signup")}
              />
              <Button
                label="I already have an account"
                variant="ghost"
                fullWidth
                onPress={() => router.push("/(auth)/login")}
              />
            </View>
            <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: 16 }}>
              By continuing you agree to our Terms and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  heroWrap: {
    flex: 1,
    minHeight: 374,
    alignItems: "center",
    paddingTop: 28,
  },
  heroStack: {
    marginTop: 28,
    width: 240,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    position: "absolute",
    left: "50%",
    width: 140,
    height: 200,
    marginLeft: -70,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 4,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroNameWrap: {
    position: "absolute",
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  bottom: {
    alignSelf: "center",
  },
});
