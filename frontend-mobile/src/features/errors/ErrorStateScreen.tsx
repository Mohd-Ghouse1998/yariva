import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArohaMark } from "../../components/ui/ArohaMark";
import { Button } from "../../components/ui/Button";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";

// Mirrors aroha_ui_deisgn_files/profile-settings.jsx > ScreenError.
export type ErrorKind = "network" | "session" | "maintenance" | "upload" | "permission";

interface Props {
  kind: ErrorKind;
  onAction?: () => void;
}

const CONFIG: Record<ErrorKind, { icon: IconName; title: string; sub: string; cta: string }> = {
  network: {
    icon: "wifi",
    title: "We can’t reach Yariva",
    sub: "Check your connection and try again.",
    cta: "Retry",
  },
  session: {
    icon: "lock",
    title: "You’ve been signed out",
    sub: "It’s been a while — please sign back in.",
    cta: "Sign in",
  },
  maintenance: {
    icon: "sparkle",
    title: "A short pause for upgrades",
    sub: "We’re back in a few minutes. Thanks for waiting.",
    cta: "Try again",
  },
  upload: {
    icon: "warning",
    title: "Upload didn’t go through",
    sub: "Try a different photo or check your connection.",
    cta: "Try again",
  },
  permission: {
    icon: "lock",
    title: "Camera access needed",
    sub: "Enable camera in Settings to add photos.",
    cta: "Open Settings",
  },
};

export const ErrorStateScreen: React.FC<Props> = ({ kind, onAction }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const cfg = CONFIG[kind];
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.wrap}>
        <ArohaMark size={36} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <Icon name={cfg.icon} size={36} color={palette.brand} strokeWidth={1.5} />
          </View>
          <Text variant="title" align="center">
            {cfg.title}
          </Text>
          <Text variant="body" color="textSubdued" align="center" style={{ lineHeight: 22 }}>
            {cfg.sub}
          </Text>
        </View>
        <Button
          label={cfg.cta}
          variant="primary"
          fullWidth
          onPress={onAction ?? (() => undefined)}
        />
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  wrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.brandSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
}));
