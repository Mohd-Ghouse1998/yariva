import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import type { VibeDto } from "../../types/vibe";

export const VibeProfilePreview: React.FC<{
  vibe: VibeDto;
  displayName: string;
}> = ({ vibe, displayName }) => {
  const { palette } = useTheme();
  const [playing, setPlaying] = useState(false);
  const player = useVideoPlayer(vibe.playbackUrl, (instance) => {
    instance.loop = true;
    instance.muted = vibe.audioMode === "MUTED";
  });

  const togglePlayback = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    player.currentTime = 0;
    player.play();
    setPlaying(true);
  };

  const audioLabel =
    vibe.audioMode === "MUTED"
      ? "No audio"
      : vibe.audioMode === "CUSTOM"
        ? vibe.musicName ?? "Music"
        : "Original audio";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${playing ? "Pause" : "Play"} ${displayName}'s Vibe. ${audioLabel}`}
      onPress={togglePlayback}
      style={[styles.preview, { backgroundColor: palette.alwaysInk }]}
    >
      {vibe.thumbnailUrl ? (
        <Image source={vibe.thumbnailUrl} contentFit="cover" style={StyleSheet.absoluteFill} />
      ) : null}
      {vibe.playbackUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}
      <View style={styles.playOverlay} pointerEvents="none">
        <View style={[styles.playButton, { backgroundColor: palette.whiteAlpha86 }]}>
          <Icon
            name={playing ? "pause" : "play"}
            size={22}
            color={palette.alwaysInk}
            filled
          />
        </View>
      </View>
      <View style={[styles.meta, { backgroundColor: palette.inkAlpha50 }]} pointerEvents="none">
        <View style={styles.metaLabel}>
          <Icon name="video" size={14} color={palette.alwaysWhite} filled />
          <Text variant="captionStrong" color="alwaysWhite">5s Vibe</Text>
        </View>
        <View style={styles.metaLabel}>
          <Icon
            name={vibe.audioMode === "MUTED" ? "micOff" : "music"}
            size={14}
            color={palette.alwaysWhite}
          />
          <Text variant="caption" color="alwaysWhite" numberOfLines={1} style={styles.audioLabel}>
            {audioLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  preview: {
    height: 180,
    overflow: "hidden",
    borderRadius: radius.lg,
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  metaLabel: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  audioLabel: { maxWidth: 150 },
});
