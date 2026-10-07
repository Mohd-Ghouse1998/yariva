import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { ArohaWordmark } from "../../components/ui/ArohaMark";
import { Button } from "../../components/ui/Button";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { Screen } from "../../components/layout/Screen";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";

// Mirrors aroha_ui_deisgn_files/auth.jsx > ScreenOnboardIntro.
const FEATURES: Array<{
  icon: IconName;
  title: string;
  text: string;
}> = [
  {
    icon: "heart",
    title: "Dating with clear intent",
    text: "See the full person before choosing Interested or Not for me.",
  },
  {
    icon: "spark",
    title: "Small, curated discovery",
    text: "A limited daily set built around compatibility, not endless swiping.",
  },
  {
    icon: "shield",
    title: "Safer real-world dates",
    text: "Mutual Date Plans, public venues, check-ins, and private post-date feedback.",
  },
];

export const OnboardingIntroScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  return (
    <Screen
      padded={false}
      scroll
      decoration="onboarding"
      edges={["top", "bottom", "left", "right"]}
      bottomBar={
        <Button
          label="Build my dating profile"
          variant="primary"
          fullWidth
          onPress={() => router.push("/(onboarding)/basic-info")}
        />
      }
    >
      <View style={styles.markRow}>
        <ArohaWordmark size={28} />
      </View>
      <View style={styles.body}>
        <Text variant="title">Dating that leads somewhere real.</Text>
        <View style={styles.list}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.row}>
              <View style={styles.iconTile}>
                <Icon name={f.icon} size={22} color={palette.brandStrong} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 16, letterSpacing: -0.2 }}>
                  {f.title}
                </Text>
                <Text
                  variant="caption"
                  color="textSubdued"
                  style={{ marginTop: 3, lineHeight: 19 }}
                >
                  {f.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  markRow: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  body: {
    paddingHorizontal: 28,
    paddingTop: 32,
    minHeight: 380,
  },
  list: {
    marginTop: 32,
    gap: 22,
  },
  row: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.brandSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
}));
