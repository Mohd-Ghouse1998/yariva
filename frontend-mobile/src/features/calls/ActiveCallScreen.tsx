import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { conversationsApi } from "../../api/endpoints/conversations";
import { useAuth } from "../../auth/AuthContext";
import { Avatar } from "../../components/ui/Avatar";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { shadows } from "../../theme/shadows";
import { fontFamilies } from "../../theme/typography";
import type { ConversationDetailDto } from "../../types/conversation";
import { CallShell } from "./CallShell";
import { useCallManager } from "./CallManager";
import { getRtcStreamUrl } from "./callLogic";
import { getRtcView } from "./webrtc";
import { useLocalization } from "../../localization/LocalizationContext";
import { introductionPromptKey } from "./introductionPrompt";

// Mirrors aroha_ui_deisgn_files/calls.jsx > ScreenCallActive (and outgoing).
// Status pill at top, large avatar in faint ring, name + timer, control row
// (mute / speaker / video / more), red end-call button.
export const ActiveCallScreen: React.FC = () => {
  const { t } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const { active, endActive, localStream, remoteStream } = useCallManager();
  const [muted, setMuted] = useState(false);
  const [video, setVideo] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);

  useEffect(() => {
    if (!active || active.status !== "CONNECTED") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    setSeconds(0);
    setMuted(false);
    setVideo(active?.callType === "VIDEO");
  }, [active?.id, active?.callType]);

  useEffect(() => {
    setConversation(null);
    if (!active?.conversationId) return;
    void conversationsApi
      .get(active.conversationId)
      .then(setConversation)
      .catch(() => undefined);
  }, [active?.conversationId]);

  if (!active) {
    return (
      <CallShell>
        <SafeAreaView
          edges={["top", "bottom", "left", "right"]}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View style={styles.emptyIcon}>
            <Icon name="phoneOff" size={30} color={palette.alwaysWhite} />
          </View>
          <Text variant="title" color="textInverse" style={{ marginTop: 20 }}>
            No active call
          </Text>
          <Text variant="body" style={styles.emptyCopy}>
            The call has ended or is no longer available.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Chat"
            onPress={() => router.replace("/(app)/(tabs)/chats")}
            style={styles.emptyBackButton}
          >
            <Text variant="bodyStrong" style={{ color: palette.alwaysWhite }}>
              Go back
            </Text>
          </Pressable>
        </SafeAreaView>
      </CallShell>
    );
  }

  const connected = active.status === "CONNECTED" || !!remoteStream;
  const isInitiator = active.initiatorUserId === user?.id;
  const isOutgoing = isInitiator && !connected;
  const timer = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  const status = connected
    ? "Connected · End-to-end encrypted"
    : isInitiator
      ? "Calling…"
      : "Connecting…";
  const partner = conversation?.otherUser;
  const partnerPhoto = partner?.photos.find((p) => p.isPrimary)?.url ?? partner?.photos[0]?.url;
  const callLabel = active.purpose === "VOICE_INTRODUCTION" ? t("hello.action") : active.callType === "VIDEO" ? "Video call" : "Voice call";
  const displayName = partner?.displayName ?? callLabel;
  const RtcView = getRtcView();
  const isVideoCall = active.callType === "VIDEO";
  const remoteVideoUrl = isVideoCall ? getRtcStreamUrl(remoteStream) : null;
  const localVideoUrl = isVideoCall && video ? getRtcStreamUrl(localStream) : null;
  const stageVideoUrl = remoteVideoUrl ?? localVideoUrl;
  const stageIsLocal = !remoteVideoUrl && Boolean(localVideoUrl);
  const hasStageVideo = Boolean(RtcView && stageVideoUrl);
  const showLocalPreview = Boolean(RtcView && remoteVideoUrl && localVideoUrl);

  const toggleMuted = () => {
    const next = !muted;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const toggleVideo = () => {
    const next = !video;
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setVideo(next);
  };

  return (
    <CallShell photoUri={hasStageVideo ? null : partnerPhoto}>
      <View style={styles.stage}>
        {RtcView && stageVideoUrl ? (
          <RtcView
            pointerEvents="none"
            streamURL={stageVideoUrl}
            mirror={stageIsLocal}
            objectFit="cover"
            zOrder={0}
            style={styles.stageVideo}
          />
        ) : null}
        {hasStageVideo ? (
          <LinearGradient
            pointerEvents="none"
            colors={[palette.mediaScrimTop, palette.mediaScrimMid, palette.mediaScrimBottom]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
          <View style={styles.body}>
            <View style={styles.topArea}>
              {hasStageVideo ? (
                <Text variant="subheading" numberOfLines={1} style={styles.stageName}>
                  {displayName}
                </Text>
              ) : null}
              <View style={styles.statusRow}>
                {connected ? <View style={styles.greenDot} /> : null}
                <Text variant="caption" style={styles.kicker}>
                  {hasStageVideo && connected ? `${timer} · End-to-end encrypted` : status}
                </Text>
              </View>
            </View>

            {!hasStageVideo ? (
              <View style={styles.centerArea}>
                <View style={styles.avatarBlock}>
                  <Avatar size={112} uri={partnerPhoto} initials={displayName} />
                  {isOutgoing ? <View style={styles.pulseRing} /> : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.timer}>{connected ? timer : callLabel}</Text>
                {active.purpose === "VOICE_INTRODUCTION" ? <Text variant="body" align="center" style={styles.emptyCopy}>{t(introductionPromptKey(active.introductionPrompt))}</Text> : null}
              </View>
            ) : null}

            {RtcView && showLocalPreview && localVideoUrl ? (
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel="Your camera preview"
                style={styles.localPreview}
              >
                <RtcView
                  pointerEvents="none"
                  streamURL={localVideoUrl}
                  mirror
                  objectFit="cover"
                  zOrder={1}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.localPreviewLabel}>
                  <Text variant="micro" style={styles.localPreviewText}>
                    You
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ flex: 1 }} />

            {!isOutgoing ? (
              <View style={styles.controlRow}>
                <ControlBtn
                  icon={muted ? "micOff" : "mic"}
                  label={muted ? "Unmute" : "Mute"}
                  active={muted}
                  onPress={toggleMuted}
                />
                {active.callType === "VIDEO" ? (
                  <ControlBtn
                    icon="video"
                    label={video ? "Turn camera off" : "Turn camera on"}
                    active={video}
                    onPress={toggleVideo}
                  />
                ) : null}
              </View>
            ) : null}

            <View style={{ alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isOutgoing ? "Cancel call" : "End call"}
                onPress={() => void endActive()}
                style={[styles.hangup, shadows.lg]}
              >
                <Icon name="phoneOff" size={28} color={palette.alwaysWhite} />
              </Pressable>
              {isOutgoing ? (
                <Text variant="caption" style={[styles.controlLabel, { marginTop: 8 }]}>
                  Cancel
                </Text>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </CallShell>
  );
};

const ControlBtn: React.FC<{
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}> = ({ icon, label, active, onPress }) => {
  const { palette } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.controlCol}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={[
          styles.controlBtn,
          { backgroundColor: active ? palette.alwaysWhite : palette.whiteAlpha18 },
        ]}
      >
        <Icon name={icon} size={22} color={active ? palette.alwaysInk : palette.alwaysWhite} />
      </Pressable>
      <Text variant="caption" style={styles.controlLabel}>
        {label}
      </Text>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  stage: {
    flex: 1,
  },
  stageVideo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  body: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
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
    color: palette.whiteAlpha70,
    marginTop: 8,
    lineHeight: 21,
    textAlign: "center",
  },
  emptyBackButton: {
    minHeight: 48,
    marginTop: 26,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.whiteAlpha42,
  },
  topArea: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "78%",
  },
  stageName: {
    color: palette.alwaysWhite,
    maxWidth: "100%",
    textAlign: "center",
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
  },
  kicker: {
    color: palette.whiteAlpha70,
    fontSize: 12,
    lineHeight: 16,
  },
  centerArea: {
    width: "100%",
    alignItems: "center",
    marginTop: 58,
  },
  avatarBlock: {
    position: "relative",
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.whiteAlpha28,
  },
  name: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "600",
    color: palette.alwaysWhite,
    marginTop: 18,
    letterSpacing: 0,
    maxWidth: "90%",
    textAlign: "center",
  },
  timer: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 22,
    color: palette.whiteAlpha85,
    marginTop: 2,
    textAlign: "center",
  },
  localPreview: {
    position: "absolute",
    top: 72,
    right: 0,
    width: 96,
    height: 128,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.whiteAlpha42,
    backgroundColor: palette.alwaysInk,
    overflow: "hidden",
  },
  localPreviewLabel: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: palette.inkAlpha55,
  },
  localPreviewText: {
    color: palette.alwaysWhite,
    fontSize: 10,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    marginBottom: 28,
  },
  controlCol: {
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  controlLabel: {
    color: palette.whiteAlpha85,
    fontSize: 11,
  },
  hangup: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.error,
    alignItems: "center",
    justifyContent: "center",
  },
}));
