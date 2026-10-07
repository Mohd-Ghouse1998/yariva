import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Text } from "../../components/ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import type { SceneDto } from "../../types/scenes";
import { sceneElapsedProgress, sceneRemainingLabel } from "./sceneTime";

export interface SceneViewerIdentity {
  displayName: string;
  age?: number | null;
  photoUrl?: string | null;
}

interface SceneViewerProps {
  identity: SceneViewerIdentity;
  scene: SceneDto;
  mode: "candidate" | "owner";
  busy?: boolean;
  onClose: () => void;
  onLike?: () => Promise<boolean>;
  onReply?: (message: string) => Promise<boolean>;
  onEdit?: () => void;
  onEnd?: () => void;
}

export const SceneViewer: React.FC<SceneViewerProps> = ({
  identity,
  scene,
  mode,
  busy = false,
  onClose,
  onLike,
  onReply,
  onEdit,
  onEnd,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const { t } = useLocalization();
  const [reply, setReply] = useState("");
  const [liked, setLiked] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => setLiked(false), [scene.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const intent =
    scene.intent === "DATING"
      ? t("scene.intent.dating")
      : scene.intent === "FRIENDSHIP"
        ? t("scene.intent.friendship")
        : t("scene.intent.casualHang");
  const timing = scene.availableUntil
    ? new Date(scene.availableUntil).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const remaining = sceneRemainingLabel(scene.expiresAt, now);
  const progress = sceneElapsedProgress(scene.createdAt, scene.expiresAt, now);
  const progressWidth = `${Math.round(progress * 1000) / 10}%` as `${number}%`;
  const replyText = reply.trim();
  const age = identity.age === null || identity.age === undefined ? "" : `, ${identity.age}`;
  const photoUrl = scene.photo?.url ?? identity.photoUrl;

  const sendReply = async () => {
    if (!replyText || busy || !onReply) return;
    const sent = await onReply(replyText);
    if (sent) setReply("");
  };

  const likeScene = async () => {
    if (liked || busy || !onLike) return;
    const sent = await onLike();
    if (sent) setLiked(true);
  };

  const actionContent =
    mode === "owner" ? (
        <View style={styles.ownerActions}>
          <Pressable
            onPress={onEdit}
            disabled={busy || !onEdit}
            accessibilityRole="button"
            accessibilityLabel={t("scene.edit")}
            style={({ pressed }) => [
              styles.ownerAction,
              pressed ? styles.actionPressed : null,
              busy || !onEdit ? styles.actionDisabled : null,
            ]}
          >
            <Icon name="edit" size={18} color={palette.alwaysWhite} />
            <Text variant="captionStrong" color="alwaysWhite">
              {t("scene.edit")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onEnd}
            disabled={busy || !onEnd}
            accessibilityRole="button"
            accessibilityLabel={t("scene.end")}
            style={({ pressed }) => [
              styles.ownerAction,
              pressed ? styles.actionPressed : null,
              busy || !onEnd ? styles.actionDisabled : null,
            ]}
          >
            <Icon name="close" size={19} color={palette.alwaysWhite} />
            <Text variant="captionStrong" color="alwaysWhite">
              {t("scene.end")}
            </Text>
          </Pressable>
        </View>
      ) : (
      <View style={styles.candidateActions}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          editable={!busy}
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={() => void sendReply()}
          placeholder={t("scene.reply.placeholder", { name: identity.displayName })}
          placeholderTextColor={palette.whiteAlpha70}
          selectionColor={palette.alwaysWhite}
          style={styles.replyInput}
          accessibilityLabel={t("scene.reply.placeholder", { name: identity.displayName })}
        />
        <Pressable
          onPress={() => void likeScene()}
          disabled={liked || busy || !onLike}
          accessibilityRole="button"
          accessibilityLabel={t("scene.like.action", { name: identity.displayName })}
          accessibilityState={{ selected: liked, disabled: liked || busy || !onLike }}
          style={({ pressed }) => [
            styles.iconAction,
            pressed ? styles.actionPressed : null,
            busy || !onLike ? styles.actionDisabled : null,
          ]}
        >
          <Icon
            name={liked ? "heartFill" : "heart"}
            size={25}
            color={liked ? palette.like : palette.alwaysWhite}
          />
        </Pressable>
        <Pressable
          onPress={() => void sendReply()}
          disabled={!replyText || busy || !onReply}
          accessibilityRole="button"
          accessibilityLabel={t("scene.reply.send")}
          style={({ pressed }) => [
            styles.iconAction,
            pressed ? styles.actionPressed : null,
            !replyText || busy || !onReply ? styles.actionDisabled : null,
          ]}
        >
          <Icon name="send" size={23} color={palette.alwaysWhite} filled />
        </Pressable>
      </View>
    );

  return (
    <View style={styles.screen}>
      {photoUrl ? (
        <Image
          source={photoUrl}
          contentFit="cover"
          transition={160}
          style={styles.photo}
          accessibilityLabel={`${identity.displayName}'s Scene photo`}
        />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Icon name="user" size={52} color={palette.whiteAlpha70} />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={[palette.inkAlpha45, palette.mediaScrimMid, palette.mediaScrimBottom]}
        locations={[0, 0.42, 1]}
        style={styles.scrim}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          <View style={styles.topGroup}>
            <View
              style={styles.progressTrack}
              accessibilityLabel={t("scene.time.left", { time: remaining })}
            >
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <View style={styles.header}>
              {identity.photoUrl ? (
                <Image
                  source={identity.photoUrl}
                  contentFit="cover"
                  transition={120}
                  style={styles.avatar}
                  accessibilityLabel={`${identity.displayName}'s profile photo`}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Icon name="user" size={17} color={palette.alwaysWhite} />
                </View>
              )}
              <Text variant="bodyStrong" color="alwaysWhite" numberOfLines={1} style={styles.name}>
                {identity.displayName}
                {age}
              </Text>
              <Text variant="micro" color="alwaysWhite" numberOfLines={1} style={styles.timer}>
                {t("scene.time.left", { time: remaining })}
              </Text>
              <IconButton tone="ghost" size={40} accessibilityLabel="Close Scene" onPress={onClose}>
                <Icon name="x" size={21} color={palette.alwaysWhite} />
              </IconButton>
            </View>
          </View>

          <View style={styles.copy}>
            <Text variant="micro" color="alwaysWhite" style={styles.eyebrow}>
              {t("scene.activity.viewerLabel")}
            </Text>
            <Text variant="title" color="alwaysWhite" numberOfLines={2} style={styles.title}>
              {scene.activity}
            </Text>
            <Text variant="caption" color="alwaysWhite" numberOfLines={1}>
              {`${intent} · ${timing ?? t("scene.availability.flexible")}`}
            </Text>
            {actionContent}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: { flex: 1, backgroundColor: palette.alwaysInk },
  photo: { position: "absolute", inset: 0 },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", inset: 0 },
  keyboard: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topGroup: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  progressTrack: {
    width: "100%",
    height: 2,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: palette.whiteAlpha28,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: palette.alwaysWhite,
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.whiteAlpha70,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.whiteAlpha18,
  },
  name: { flex: 1, marginLeft: spacing.xs },
  timer: { marginLeft: spacing.sm, color: palette.whiteAlpha70 },
  copy: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  eyebrow: { color: palette.whiteAlpha70, letterSpacing: 0.9 },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  candidateActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  replyInput: {
    ...typography.body,
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.whiteAlpha50,
    backgroundColor: palette.whiteAlpha10,
    color: palette.alwaysWhite,
  },
  iconAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  ownerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ownerAction: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.whiteAlpha50,
    backgroundColor: palette.whiteAlpha10,
  },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  actionDisabled: { opacity: 0.4 },
}));
