import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { privateStoriesApi, type Story } from "../../api/endpoints/privateStories";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";
import { controlSize, radius, spacing } from "../../theme/spacing";

const StoryVideo: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, instance => { instance.loop = false; instance.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
};

export const PrivateStoryViewer: React.FC<{ storyId: string | null; onClose: () => void; canReport?: boolean }> = ({ storyId, onClose, canReport = false }) => {
  const router = useRouter();
  const { palette } = useTheme();
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const requestVersion = useRef(0);
  const load = useCallback(async (id: string) => {
    const version = ++requestVersion.current;
    setStory(null); setError(null); setLoading(true); setElapsed(0); setPaused(false);
    try { const result = await privateStoriesApi.detail(id); if (version === requestVersion.current) setStory(result.story); }
    catch { if (version === requestVersion.current) setError("This Story is unavailable or has expired. Check your connection and try again."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, []);
  useEffect(() => {
    if (storyId) void load(storyId);
    else { setStory(null); setError(null); }
    return () => { requestVersion.current += 1; };
  }, [storyId, load]);
  const timed = !!story && !story.mediaMimeType?.startsWith("video/");
  const timerFinished = elapsed >= 8000;
  useEffect(() => {
    if (!timed || paused || timerFinished) return;
    const timer = setInterval(() => setElapsed(value => Math.min(8000, value + 100)), 100);
    return () => clearInterval(timer);
  }, [timed, paused, timerFinished]);
  const expires = story ? new Date(story.expiresAt).getTime() : 0;
  const remaining = Math.max(0, Math.ceil((expires - Date.now()) / 60000));
  return <Modal visible={!!storyId} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <SafeAreaView style={[styles.root, { backgroundColor: palette.alwaysInk }]}>
      <View style={styles.top}>
        {timed ? <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Resume Story timer" : elapsed >= 8000 ? "Replay Story timer" : "Pause Story timer"} onPress={() => { if (elapsed >= 8000) { setElapsed(0); setPaused(false); } else setPaused(value => !value); }} style={[styles.progressTrack, { backgroundColor: palette.whiteAlpha42 }]}><View style={[styles.progressFill, { backgroundColor: palette.alwaysWhite, width: `${elapsed / 80}%` }]} /></Pressable> : null}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: palette.ctaStart }]}><Icon name="lock" size={17} color={palette.alwaysWhite} /></View>
          <View style={{ flex: 1 }}><Text variant="captionStrong" color="alwaysWhite">{story?.ownerName ?? "Private Story"}</Text><Text variant="micro" color="alwaysWhite">{story ? remaining ? `Expires in ${remaining < 60 ? `${remaining}m` : `${Math.ceil(remaining / 60)}h`}` : "Expired" : "Shared privately"}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Story" onPress={onClose} style={styles.close}><Icon name="close" size={24} color={palette.alwaysWhite} /></Pressable>
        </View>
      </View>
      <View style={styles.stage}>
        {loading ? <ActivityIndicator color={palette.alwaysWhite} /> : null}
        {error ? <View style={styles.errorState}><Text color="alwaysWhite" align="center" accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry loading Story" onPress={() => storyId && void load(storyId)} style={[styles.retry, { backgroundColor: palette.ctaStart }]}><Text variant="bodyStrong" color="alwaysWhite">Retry</Text></Pressable></View> : null}
        {story?.mediaUrl && story.mediaMimeType?.startsWith("image/") ? <Image source={story.mediaUrl} cachePolicy="none" contentFit="contain" style={StyleSheet.absoluteFill} onError={() => { setStory(null); setError("Couldn’t load this photo. Try opening the Story again."); }} /> : null}
        {story?.mediaUrl && story.mediaMimeType?.startsWith("video/") ? <StoryVideo uri={story.mediaUrl} /> : null}
        {story?.text ? <View style={[styles.caption, { backgroundColor: story.mediaUrl ? palette.inkAlpha85 : palette.alwaysInk }]}><Text variant={story.mediaUrl ? "bodyLarge" : "title"} color="alwaysWhite" align="center">{story.text}</Text></View> : null}
      </View>
      <View style={styles.footer}><Icon name="lock" size={15} color={palette.alwaysWhite} /><Text variant="caption" color="alwaysWhite">Approved audience only</Text>{timed ? <Text variant="caption" color="alwaysWhite">· {paused ? "Paused" : timerFinished ? "Replay above" : `${Math.ceil((8000 - elapsed) / 1000)}s`}</Text> : null}{story && canReport ? <Pressable accessibilityRole="button" accessibilityLabel="Report this Story" onPress={() => { onClose(); router.push({ pathname: "/(app)/report", params: { targetType: "PRIVATE_STORY", targetId: story.id, reportedUserId: story.ownerId } }); }} style={styles.report}><Text variant="captionStrong" color="alwaysWhite">Report</Text></Pressable> : null}</View>
    </SafeAreaView>
  </Modal>;
};

const styles = StyleSheet.create({
  root: { flex: 1 }, top: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
  progressTrack: { height: controlSize.minimumTouchTarget, justifyContent: "center" }, progressFill: { height: 3, borderRadius: radius.xs }, header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, justifyContent: "center", alignItems: "center" },
  caption: { maxWidth: "88%", paddingHorizontal: 24, paddingVertical: 18, borderRadius: 20, zIndex: 1 },
  errorState: { alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.xl },
  retry: { minHeight: controlSize.minimumTouchTarget, borderRadius: radius.button, minWidth: 120, alignItems: "center", justifyContent: "center" },
  footer: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, flexWrap: "wrap" },
  report: { minHeight: controlSize.minimumTouchTarget, paddingHorizontal: spacing.sm, justifyContent: "center" },
});
