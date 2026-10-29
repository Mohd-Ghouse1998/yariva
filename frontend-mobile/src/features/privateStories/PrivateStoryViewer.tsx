import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { privateStoriesApi, type Story } from "../../api/endpoints/privateStories";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { PrivateStoryOptionsSheet } from "./PrivateStoryOptionsSheet";
import { formatRelativeTime } from "../../utils/format";

const PHOTO_DURATION_MS = 8000;

interface StoryVideoProps {
  uri: string;
  paused: boolean;
  onReady: (ready: boolean) => void;
  onProgress: (progress: number) => void;
  onEnd: () => void;
  onError: () => void;
}

const StoryVideo: React.FC<StoryVideoProps> = ({
  uri,
  paused,
  onReady,
  onProgress,
  onEnd,
  onError,
}) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.1;
  });
  useEffect(() => {
    const updateStatus = (status: string) => {
      onReady(status === "readyToPlay");
      if (status === "error") onError();
    };
    const subscriptions = [
      player.addListener("statusChange", ({ status }) => updateStatus(status)),
      player.addListener("timeUpdate", ({ currentTime }) => {
        if (player.duration > 0) onProgress(Math.min(1, currentTime / player.duration));
      }),
      player.addListener("playToEnd", onEnd),
    ];
    updateStatus(player.status);
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [player, onReady, onProgress, onEnd, onError]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [player, paused]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      surfaceType="textureView"
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
};

interface PrivateStoryViewerProps {
  storyId: string | null;
  storyIds?: string[];
  onStoryChange?: (id: string) => void;
  onClose: () => void;
  canReport?: boolean;
  onOwnerChange?: (id: string, story: Story | null) => void;
  onEdit?: (story: Story) => void;
}

export const PrivateStoryViewer: React.FC<PrivateStoryViewerProps> = ({
  storyId,
  storyIds,
  onStoryChange,
  onClose,
  canReport = false,
  onOwnerChange,
  onEdit,
}) => {
  const router = useRouter();
  const { palette } = useTheme();
  const [owner, setOwner] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoFinished, setVideoFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [readingCaption, setReadingCaption] = useState(false);
  const [screenReaderPending, setScreenReaderPending] = useState(true);
  const screenReader = useRef(false);
  const requestVersion = useRef(0);
  const active = useRef(AppState.currentState === "active");
  const longPress = useRef(false);
  const queue = useMemo(
    () =>
      storyIds?.includes(storyId ?? "") && onStoryChange ? storyIds : storyId ? [storyId] : [],
    [storyIds, storyId, onStoryChange],
  );
  const index = Math.max(0, queue.indexOf(storyId ?? ""));
  const move = useCallback(
    (direction: number) => {
      const target = queue[index + direction];
      if (target && onStoryChange) onStoryChange(target);
      else if (direction > 0) onClose();
    },
    [queue, index, onStoryChange, onClose],
  );
  // Keep native subscriptions stable when progress updates re-render the viewer.
  const moveRef = useRef(move);
  moveRef.current = move;
  const mediaVersion = requestVersion.current;
  const mediaReady = useCallback(
    (value: boolean) => {
      if (mediaVersion === requestVersion.current) setReady(value);
    },
    [mediaVersion],
  );
  const updateVideoProgress = useCallback(
    (value: number) => {
      if (mediaVersion === requestVersion.current) setVideoProgress(value);
    },
    [mediaVersion],
  );
  const videoEnd = useCallback(() => {
    if (mediaVersion === requestVersion.current) setVideoFinished(true);
  }, [mediaVersion]);
  const mediaError = useCallback(
    (kind: "video" | "photo") => {
      if (mediaVersion !== requestVersion.current) return;
      requestVersion.current += 1;
      setStory(null);
      setReady(false);
      setError(`Couldn’t load this ${kind}. Try opening the Story again.`);
    },
    [mediaVersion],
  );
  const videoError = useCallback(() => mediaError("video"), [mediaError]);
  const load = useCallback(async (id: string) => {
    if (!active.current) return;
    const version = ++requestVersion.current;
    setStory(null);
    setOwner(false);
    setError(null);
    setLoading(true);
    setReady(false);
    setElapsed(0);
    setVideoProgress(0);
    setVideoFinished(false);
    setPaused(screenReader.current);
    setHolding(false);
    setOptionsOpen(false);
    setReadingCaption(false);
    try {
      // Queue entries always require a fresh authorized read, never feed media URLs.
      const result = await privateStoriesApi.detail(id);
      if (version !== requestVersion.current) return;
      // Only the authorized owner response includes recipientIds. A saved flag
      // alone must never bypass audience expiry on a stale recipient response.
      const isOwner = Array.isArray(result.recipientIds);
      setOwner(isOwner);
      if (
        new Date(result.story.expiresAt).getTime() <= Date.now() &&
        !(isOwner && result.story.savedAt)
      ) {
        setError("This Story has expired.");
      } else {
        setStory(result.story);
        setReady(!result.story.mediaUrl);
      }
    } catch {
      if (version === requestVersion.current)
        setError("This Story is unavailable or has expired. Check your connection and try again.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    let receivedEvent = false;
    const update = (value: boolean) => {
      if (!mounted) return;
      screenReader.current = value;
      if (value) setPaused(true);
      setScreenReaderPending(false);
    };
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", (value) => {
      receivedEvent = true;
      update(value);
    });
    // A native change is newer than the initial async snapshot. If detection fails,
    // keep playback paused until the viewer explicitly resumes it.
    void AccessibilityInfo.isScreenReaderEnabled().then(
      (value) => {
        if (!receivedEvent) update(value);
      },
      () => {
        if (!receivedEvent) update(true);
      },
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (storyId) void load(storyId);
    else {
      setStory(null);
      setError(null);
    }
    const subscription = AppState.addEventListener("change", (state) => {
      active.current = state === "active";
      requestVersion.current += 1;
      setStory(null);
      setError(null);
      setLoading(false);
      setReady(false);
      if (active.current && storyId) void load(storyId);
    });
    return () => {
      requestVersion.current += 1;
      subscription.remove();
    };
  }, [storyId, load]);
  useEffect(() => {
    if (!story || (owner && story.savedAt)) return;
    const timer = setTimeout(
      () => {
        requestVersion.current += 1;
        setStory(null);
        setReady(false);
        setOptionsOpen(false);
        setError("This Story has expired.");
      },
      Math.max(0, new Date(story.expiresAt).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [story, owner]);
  const playbackPaused = screenReaderPending || paused || holding || optionsOpen || readingCaption;
  const isVideo = !!story?.mediaMimeType?.startsWith("video/");
  const photoFinished = elapsed >= PHOTO_DURATION_MS;
  useEffect(() => {
    if (!story || !ready || isVideo || playbackPaused || photoFinished) return;
    const timer = setInterval(
      () => setElapsed((value) => Math.min(PHOTO_DURATION_MS, value + 100)),
      100,
    );
    return () => clearInterval(timer);
  }, [story, ready, isVideo, playbackPaused, photoFinished]);
  useEffect(() => {
    // Android reports idle at the same time as playToEnd. Completion is final
    // even when the player is no longer ready to play another frame.
    if (story && !playbackPaused && (isVideo ? videoFinished : ready && photoFinished))
      moveRef.current(1);
  }, [story, ready, isVideo, playbackPaused, photoFinished, videoFinished]);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 20 && gesture.dy > Math.abs(gesture.dx) * 1.5,
        onPanResponderGrant: () => setHolding(true),
        onPanResponderRelease: (_, gesture) => {
          setHolding(false);
          if (gesture.dy > 80) onClose();
        },
        onPanResponderTerminate: () => setHolding(false),
      }),
    [onClose],
  );
  const caption =
    story?.moderationStatus === "REJECTED"
      ? "This Story did not pass review and is not shared."
      : story?.text;
  const progress = isVideo ? videoProgress : elapsed / PHOTO_DURATION_MS;
  const segmentStart = Math.max(0, Math.min(index - 3, queue.length - 7));
  const privacyLabel =
    owner && story?.savedAt && Date.parse(story.expiresAt) <= Date.now()
      ? "Saved privately · only you"
      : story?.moderationStatus === "PENDING"
        ? "Awaiting review · only you can see this"
        : story?.moderationStatus === "REJECTED"
          ? "Not shared · only you can see this"
          : "Shared privately";

  return (
    <Modal
      visible={!!storyId}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => (optionsOpen ? setOptionsOpen(false) : onClose())}
    >
      {/* Android's modal inherits the app's status-bar icons. Match its top safe area to the app theme. */}
      <SafeAreaView
        edges={["top"]}
        style={[styles.root, { backgroundColor: palette.background }]}
        onAccessibilityEscape={onClose}
      >
        <SafeAreaView
          edges={["left", "right", "bottom"]}
          style={[styles.root, { backgroundColor: palette.alwaysInk }]}
        >
          <View style={styles.canvas}>
            <View style={StyleSheet.absoluteFill}>
              {story?.mediaUrl && story.mediaMimeType?.startsWith("image/") ? (
                <Image
                  key={mediaVersion}
                  source={story.mediaUrl}
                  cachePolicy="none"
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                  onLoad={() => mediaReady(true)}
                  onError={() => mediaError("photo")}
                />
              ) : null}
              {story?.mediaUrl && isVideo ? (
                <StoryVideo
                  key={mediaVersion}
                  uri={story.mediaUrl}
                  paused={playbackPaused || !ready}
                  onReady={mediaReady}
                  onProgress={updateVideoProgress}
                  onEnd={videoEnd}
                  onError={videoError}
                />
              ) : null}
            </View>
            {story ? (
              <View style={styles.navigation} {...swipe.panHandlers}>
                {([-1, 1] as const).map((direction) => (
                  <Pressable
                    key={direction}
                    style={styles.tapZone}
                    accessibilityRole="button"
                    accessibilityLabel={
                      direction < 0
                        ? index === 0
                          ? "Hold to pause Story"
                          : "Previous Story"
                        : index < queue.length - 1
                          ? "Next Story"
                          : "Finish Stories"
                    }
                    accessibilityHint="Hold to pause. Swipe down to close."
                    onPressIn={() => {
                      longPress.current = false;
                      setHolding(true);
                    }}
                    onLongPress={() => {
                      longPress.current = true;
                    }}
                    onPressOut={() => setHolding(false)}
                    onPress={() => {
                      if (!longPress.current) move(direction);
                    }}
                  />
                ))}
              </View>
            ) : null}
            {!story?.mediaUrl && caption ? (
              <ScrollView
                style={styles.textCaption}
                contentContainerStyle={styles.textCaptionContent}
                onTouchStart={() => setReadingCaption(true)}
                onTouchEnd={() => setReadingCaption(false)}
                onTouchCancel={() => setReadingCaption(false)}
              >
                <Text variant="title" color="alwaysWhite" align="center">
                  {caption}
                </Text>
              </ScrollView>
            ) : null}
            <LinearGradient
              pointerEvents="none"
              colors={[palette.inkAlpha85, palette.mediaScrimTop]}
              style={styles.topScrim}
            />
            <View style={styles.top}>
              <View
                style={styles.progressRow}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`Story ${index + 1} of ${queue.length}`}
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
              >
                {queue.slice(segmentStart, segmentStart + 7).map((id, offset) => (
                  <View
                    key={id}
                    style={[styles.progressTrack, { backgroundColor: palette.whiteAlpha28 }]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: palette.alwaysWhite,
                          width: `${(segmentStart + offset < index ? 1 : id === storyId ? progress : 0) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.header}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: palette.inkAlpha55, borderColor: palette.whiteAlpha28 },
                  ]}
                >
                  <Icon name="lock" size={16} color={palette.alwaysWhite} />
                </View>
                <View style={styles.identity}>
                  <Text variant="captionStrong" color="alwaysWhite" numberOfLines={1}>
                    {story?.ownerName ?? "Private Story"}
                  </Text>
                  {story ? (
                    <Text variant="micro" color="whiteAlpha85">
                      {formatRelativeTime(story.createdAt)}
                    </Text>
                  ) : null}
                </View>
                {story ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={paused ? "Resume Story" : "Pause Story"}
                      accessibilityState={{ selected: paused }}
                      onPress={() => setPaused((value) => !value)}
                      style={styles.control}
                    >
                      <Icon
                        name={playbackPaused ? "play" : "pause"}
                        size={20}
                        color={palette.alwaysWhite}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Story options"
                      accessibilityState={{ expanded: optionsOpen }}
                      onPress={() => setOptionsOpen((value) => !value)}
                      style={styles.control}
                    >
                      <Icon name="more" size={22} color={palette.alwaysWhite} />
                    </Pressable>
                  </>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close Story"
                  onPress={onClose}
                  style={styles.control}
                >
                  <Icon name="close" size={24} color={palette.alwaysWhite} />
                </Pressable>
              </View>
            </View>
            {loading || (story && !ready && !videoFinished) ? (
              <ActivityIndicator
                pointerEvents="none"
                style={styles.loader}
                color={palette.alwaysWhite}
                accessibilityLabel="Loading Story"
              />
            ) : null}
            {error ? (
              <View style={styles.errorState}>
                <Text color="alwaysWhite" align="center" accessibilityRole="alert">
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading Story"
                  onPress={() => storyId && void load(storyId)}
                  style={[styles.retry, { backgroundColor: palette.ctaStart }]}
                >
                  <Text variant="bodyStrong" color="alwaysWhite">
                    Retry
                  </Text>
                </Pressable>
                {index < queue.length - 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Skip unavailable Story"
                    onPress={() => move(1)}
                    style={styles.control}
                  >
                    <Icon name="chevronRight" size={24} color={palette.alwaysWhite} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {story ? (
              <View pointerEvents="box-none" style={styles.bottom}>
                <LinearGradient
                  pointerEvents="none"
                  colors={[palette.mediaScrimTop, palette.mediaScrimBottom]}
                  style={StyleSheet.absoluteFill}
                />
                {story.mediaUrl && caption ? (
                  <ScrollView
                    style={styles.mediaCaption}
                    contentContainerStyle={styles.captionContent}
                    onTouchStart={() => setReadingCaption(true)}
                    onTouchEnd={() => setReadingCaption(false)}
                    onTouchCancel={() => setReadingCaption(false)}
                    onScrollBeginDrag={() => setReadingCaption(true)}
                    onMomentumScrollEnd={() => setReadingCaption(false)}
                  >
                    <Text variant="body" color="alwaysWhite">
                      {caption}
                    </Text>
                  </ScrollView>
                ) : null}
                <View style={styles.privacy}>
                  <Icon name="lock" size={12} color={palette.whiteAlpha85} />
                  <Text variant="micro" color="whiteAlpha85">
                    {privacyLabel}
                  </Text>
                </View>
              </View>
            ) : null}
            {story && optionsOpen && !owner ? (
              <View
                style={[
                  styles.options,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <Text variant="captionStrong">Story privacy</Text>
                <Text variant="caption" color="textSecondary">
                  {story.moderationStatus !== "APPROVED"
                    ? privacyLabel
                    : story.audienceRule === "SELECTED"
                      ? "Shared with selected approved connections"
                      : "Shared with approved connections"}
                </Text>
                <Text variant="caption" color="textSecondary">
                  Expires{" "}
                  {new Date(story.expiresAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                {canReport ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Report this Story"
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: "/(app)/report",
                        params: {
                          targetType: "PRIVATE_STORY",
                          targetId: story.id,
                          reportedUserId: story.ownerId,
                        },
                      });
                    }}
                    style={styles.report}
                  >
                    <Icon name="flag" size={18} color={palette.textPrimary} />
                    <Text variant="captionStrong">Report Story</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </SafeAreaView>
      {story && optionsOpen && owner ? (
        <PrivateStoryOptionsSheet
          key={story.id}
          story={story}
          onClose={() => setOptionsOpen(false)}
          onEdit={onEdit}
          onChange={(updated) => {
            if (mediaVersion !== requestVersion.current) return;
            onOwnerChange?.(story.id, updated);
            if (!updated || (!updated.savedAt && Date.parse(updated.expiresAt) <= Date.now())) {
              setStory(null);
              onClose();
            } else setStory(updated);
          }}
        />
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvas: { flex: 1, overflow: "hidden" },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  progressRow: { flexDirection: "row", gap: spacing.xs },
  progressTrack: { flex: 1, height: 3, borderRadius: radius.xs, overflow: "hidden" },
  progressFill: { height: "100%" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, marginTop: spacing.xs },
  identity: { flex: 1, marginLeft: spacing.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  control: {
    minWidth: controlSize.minimumTouchTarget,
    minHeight: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  navigation: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  tapZone: { flex: 1 },
  textCaption: {
    flex: 1,
    marginTop: 80,
    marginBottom: 52,
    marginHorizontal: controlSize.minimumTouchTarget,
  },
  textCaptionContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "32%",
    paddingTop: spacing.xxl,
  },
  mediaCaption: { flexGrow: 0 },
  captionContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  loader: { position: "absolute", alignSelf: "center", top: "48%" },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
    marginTop: 80,
  },
  retry: {
    minHeight: controlSize.minimumTouchTarget,
    borderRadius: radius.button,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  options: {
    position: "absolute",
    top: 68,
    right: spacing.md,
    left: spacing.xxl,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
  },
  report: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
