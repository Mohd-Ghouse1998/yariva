import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/ui/Avatar";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { shadows } from "../../theme/shadows";
import { fontFamilies } from "../../theme/typography";
import { CallShell } from "./CallShell";
import { useCallManager } from "./CallManager";
import { useLocalization } from "../../localization/LocalizationContext";
import { introductionPromptKey } from "./introductionPrompt";

// Mirrors aroha_ui_deisgn_files/calls.jsx > ScreenCallIncoming.
export const IncomingCallScreen: React.FC = () => {
  const { t } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { incoming, incomingCaller, acceptIncoming, declineIncoming } = useCallManager();
  const [pendingAction, setPendingAction] = useState<"accept" | "decline" | null>(null);

  const accept = async () => {
    if (pendingAction) return;
    setPendingAction("accept");
    try {
      await acceptIncoming();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Couldn’t accept this call.", "error");
      setPendingAction(null);
    }
  };

  const decline = async () => {
    if (pendingAction) return;
    setPendingAction("decline");
    try {
      await declineIncoming();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Couldn’t decline this call.", "error");
      setPendingAction(null);
    }
  };

  if (!incoming) {
    return (
      <CallShell>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
          <View style={[styles.body, styles.emptyBody]}>
            <View style={styles.emptyIcon}>
              <Icon name="phoneOff" size={30} color={palette.alwaysWhite} />
            </View>
            <Text style={[styles.name, { lineHeight: 44 }]}>No incoming call</Text>
            <Text variant="body" style={[styles.subline, styles.emptyCopy]}>
              This call may have ended or was answered on another device.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to Discover"
              onPress={() => router.replace("/(app)/(tabs)/discover")}
              style={styles.backButton}
            >
              <Text variant="bodyStrong" style={{ color: palette.alwaysWhite }}>
                Go back
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </CallShell>
    );
  }

  const displayName = incomingCaller?.displayName ?? "Yariva member";
  const profilePhoto =
    incomingCaller?.photos.find((photo) => photo.isPrimary)?.url ?? incomingCaller?.photos[0]?.url;

  return (
    <CallShell>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <View style={styles.body}>
          <Text variant="caption" style={styles.kicker}>
            {incoming.purpose === "VOICE_INTRODUCTION" ? t("hello.incoming") : `Incoming ${incoming.callType === "VIDEO" ? "video" : "voice"} call · Yariva`}
          </Text>
          <View style={styles.avatarRing}>
            <Avatar size={140} uri={profilePhoto} initials={displayName} />
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text variant="body" style={styles.subline}>
            {incoming.purpose === "VOICE_INTRODUCTION" ? t(introductionPromptKey(incoming.introductionPrompt)) : "You allowed this person to call you."}
          </Text>
          <View style={styles.allowedPill}>
            <Icon name="shield" size={14} color={palette.alwaysWhite} />
            <Text variant="caption" style={{ color: palette.alwaysWhite, fontSize: 12 }}>
              You allowed this call
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.actionRow}>
            <View style={styles.actionCol}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decline call"
                accessibilityState={{
                  disabled: Boolean(pendingAction),
                  busy: pendingAction === "decline",
                }}
                disabled={Boolean(pendingAction)}
                style={[styles.actionBtn, { backgroundColor: palette.error }, shadows.lg]}
                onPress={() => void decline()}
              >
                {pendingAction === "decline" ? (
                  <ActivityIndicator color={palette.alwaysWhite} />
                ) : (
                  <Icon name="phoneOff" size={28} color={palette.alwaysWhite} />
                )}
              </Pressable>
              <Text variant="caption" style={styles.actionLabel}>
                Decline
              </Text>
            </View>
            <View style={styles.actionCol}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Accept call"
                accessibilityState={{
                  disabled: Boolean(pendingAction),
                  busy: pendingAction === "accept",
                }}
                disabled={Boolean(pendingAction)}
                style={[styles.actionBtn, { backgroundColor: palette.success }, shadows.lg]}
                onPress={() => void accept()}
              >
                {pendingAction === "accept" ? (
                  <ActivityIndicator color={palette.alwaysWhite} />
                ) : (
                  <Icon name="phone" size={28} color={palette.alwaysWhite} />
                )}
              </Pressable>
              <Text variant="caption" style={styles.actionLabel}>
                Accept
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </CallShell>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  body: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  kicker: {
    color: palette.whiteAlpha70,
    letterSpacing: 0.5,
    fontSize: 13,
  },
  avatarRing: {
    marginTop: 36,
    padding: 4,
    borderRadius: 999,
    backgroundColor: palette.whiteAlpha18,
  },
  name: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    fontWeight: "500",
    color: palette.alwaysWhite,
    marginTop: 24,
    letterSpacing: -0.6,
    lineHeight: 44,
    textAlign: "center",
  },
  subline: {
    color: palette.whiteAlpha70,
    marginTop: 6,
    fontSize: 14,
  },
  allowedPill: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: palette.whiteAlpha14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 60,
    alignItems: "center",
  },
  actionCol: {
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: palette.whiteAlpha85,
    fontSize: 12,
  },
  emptyBody: {
    justifyContent: "center",
    paddingTop: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.whiteAlpha14,
  },
  emptyCopy: {
    maxWidth: 290,
    lineHeight: 21,
    textAlign: "center",
  },
  backButton: {
    minHeight: 48,
    marginTop: 26,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.whiteAlpha42,
  },
}));
