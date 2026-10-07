import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../../components/layout/Header";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { useCallManager } from "./CallManager";

// Mirrors aroha_ui_deisgn_files/calls.jsx > ScreenCallMissed.
export const MissedCallScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const callManager = useCallManager();
  const params = useLocalSearchParams<{
    matchId?: string;
    name?: string;
    when?: string;
  }>();
  const name = params.name ?? "Match";

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header showBack onLeftPress={() => router.back()} title={name} leftIcon={null} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <Icon name="phoneOff" size={32} color={palette.error} />
          </View>
          <Text variant="titleSm" align="center">
            Missed call from {name}
          </Text>
          <Text variant="caption" color="textSubdued" align="center">
            {params.when ?? "Today"}
          </Text>
          <View style={{ width: "100%", gap: 10, marginTop: 10 }}>
            <Button
              label={`Call ${name} back`}
              variant="primary"
              fullWidth
              leftIcon={<Icon name="phone" size={18} color={palette.alwaysWhite} />}
              onPress={() => {
                if (params.matchId) {
                  void callManager
                    .startOutgoingCall({
                      matchId: params.matchId,
                      callType: "VOICE",
                    })
                    .catch((error) =>
                      toast.show(
                        error instanceof Error ? error.message : "Couldn’t start call.",
                        "error",
                      ),
                    );
                }
              }}
            />
            <Button
              label="Message instead"
              variant="secondary"
              fullWidth
              leftIcon={<Icon name="chat" size={18} color={palette.textPrimary} />}
              onPress={() => {
                if (params.matchId) {
                  router.replace({
                    pathname: "/(app)/match/[matchId]",
                    params: { matchId: params.matchId },
                  });
                }
              }}
            />
          </View>
          <View style={{ flex: 1 }} />
          <Avatar size={36} initials={name.slice(0, 2)} />
        </View>
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    gap: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.errorSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
}));
