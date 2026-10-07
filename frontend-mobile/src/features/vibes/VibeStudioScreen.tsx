import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useAudioPlayer } from "expo-audio";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { vibesApi } from "../../api/endpoints/vibes";
import { uploadToPresignedUrl } from "../../api/upload";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import type { Palette } from "../../theme/colors";
import { radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import type {
  InitiateVibeUploadResponse,
  VibeAudioMode,
  VibeDto,
  VibeFilter,
} from "../../types/vibe";

const MAX_DURATION_SECONDS = 5;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_MUSIC_BYTES = 12 * 1024 * 1024;

const FILTERS: ReadonlyArray<{ key: VibeFilter; label: string }> = [
  { key: "ORIGINAL", label: "Natural" },
  { key: "WARM", label: "Golden" },
  { key: "COOL", label: "Chill" },
  { key: "MONO", label: "Noir" },
  { key: "POP", label: "Vivid" },
];

type LocalMusic = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type StudioStage = "CAMERA" | "PREVIEW" | "CURRENT";

const videoMimeTypeForUri = (uri: string): string =>
  uri.toLowerCase().split("?")[0]?.endsWith(".mov") ? "video/quicktime" : "video/mp4";

const filterOverlayToken = (filter: VibeFilter): keyof Palette | null => {
  switch (filter) {
    case "WARM":
      return "filterWarmOverlay";
    case "COOL":
      return "filterCoolOverlay";
    case "MONO":
      return "filterMonoOverlay";
    case "POP":
      return "filterPopOverlay";
    default:
      return null;
  }
};

export const VibeStudioScreen: React.FC = () => {
  const router = useRouter();
  const { palette } = useTheme();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [focused, setFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [stage, setStage] = useState<StudioStage>("CAMERA");
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [filter, setFilter] = useState<VibeFilter>("ORIGINAL");
  const [audioMode, setAudioMode] = useState<VibeAudioMode>("ORIGINAL");
  const [music, setMusic] = useState<LocalMusic | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentVibe, setCurrentVibe] = useState<VibeDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      let cancelled = false;
      void vibesApi
        .mine()
        .then(({ vibe }) => {
          if (cancelled) return;
          setCurrentVibe(vibe);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
        setFocused(false);
        cameraRef.current?.stopRecording();
      };
    }, []),
  );

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Math.min(MAX_DURATION_SECONDS * 1000, Date.now() - startedAt));
    }, 50);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (currentVibe?.status !== "PROCESSING") return;
    const timer = setInterval(() => {
      void vibesApi.mine().then(({ vibe }) => setCurrentVibe(vibe)).catch(() => undefined);
    }, 2500);
    return () => clearInterval(timer);
  }, [currentVibe?.status]);

  const permissionsGranted = Boolean(cameraPermission?.granted && microphonePermission?.granted);
  const overlayToken = filterOverlayToken(filter);
  const musicLabel =
    audioMode === "CUSTOM" && music
      ? music.name
      : audioMode === "MUTED"
        ? "No audio"
        : "Original audio";

  const requestPermissions = useCallback(async () => {
    setError(null);
    const camera = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    const microphone = microphonePermission?.granted
      ? microphonePermission
      : await requestMicrophonePermission();
    if (!camera.granted || !microphone.granted) {
      setError("Camera and microphone access are needed to record your Vibe.");
    }
  }, [
    cameraPermission,
    microphonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || recording || busy) return;
    setError(null);
    setElapsedMs(0);
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SECONDS,
        maxFileSize: MAX_VIDEO_BYTES,
      });
      if (!result?.uri) return;
      setRecordedUri(result.uri);
      setStage("PREVIEW");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t record your Vibe.");
    } finally {
      setRecording(false);
      setElapsedMs(0);
    }
  }, [busy, cameraReady, recording]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    cameraRef.current?.stopRecording();
  }, [recording]);

  const chooseMusic = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const sizeBytes = asset.size ?? new File(asset.uri).size;
    if (!sizeBytes || sizeBytes > MAX_MUSIC_BYTES) {
      setError("Choose an audio file smaller than 12 MB.");
      return;
    }
    setMusic({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "audio/mpeg",
      sizeBytes,
    });
    setAudioMode("CUSTOM");
  }, []);

  const clearSelectedMusic = useCallback(() => {
    setMusic(null);
    setAudioMode("ORIGINAL");
  }, []);

  const toggleMuted = useCallback(() => {
    setMusic(null);
    setAudioMode((mode) => (mode === "MUTED" ? "ORIGINAL" : "MUTED"));
  }, []);

  const retake = useCallback(() => {
    setRecordedUri(null);
    setStage("CAMERA");
    setError(null);
    setUploadProgress(0);
  }, []);

  const postVibe = useCallback(async () => {
    if (!recordedUri || busy) return;
    setBusy(true);
    setError(null);
    setUploadProgress(0);
    try {
      const videoFile = new File(recordedUri);
      const videoSize = videoFile.size;
      if (!videoSize || videoSize > MAX_VIDEO_BYTES) {
        throw new Error("Your recording is too large. Please retake it.");
      }
      const videoMimeType = videoMimeTypeForUri(recordedUri);
      const initiated = await vibesApi.initiateUpload({
        video: {
          fileName: videoFile.name || `vibe-${Date.now()}.mp4`,
          mimeType: videoMimeType,
          sizeBytes: videoSize,
        },
        music:
          audioMode === "CUSTOM" && music
            ? {
                fileName: music.name,
                mimeType: music.mimeType,
                sizeBytes: music.sizeBytes,
              }
            : null,
        filter,
        audioMode,
      });

      await uploadVibeAssets({
        initiated,
        video: { uri: recordedUri, mimeType: videoMimeType, sizeBytes: videoSize },
        music: audioMode === "CUSTOM" ? music : null,
        onProgress: setUploadProgress,
      });

      const { vibe } = await vibesApi.finalizeUpload(initiated.vibeId, {
        video: {
          uploadToken: initiated.video.uploadToken,
          objectKey: initiated.video.objectKey,
          bucket: initiated.video.bucket,
          mimeType: videoMimeType,
          sizeBytes: videoSize,
        },
        music:
          initiated.music && music
            ? {
                uploadToken: initiated.music.uploadToken,
                objectKey: initiated.music.objectKey,
                bucket: initiated.music.bucket,
                mimeType: music.mimeType,
                sizeBytes: music.sizeBytes,
              }
            : null,
      });
      setCurrentVibe(vibe);
      setStage("CURRENT");
      setRecordedUri(null);
      setUploadProgress(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t post your Vibe.");
    } finally {
      setBusy(false);
    }
  }, [audioMode, busy, filter, music, recordedUri]);

  const removeCurrent = useCallback(async () => {
    if (!currentVibe || busy) return;
    setBusy(true);
    setError(null);
    try {
      await vibesApi.remove(currentVibe.id);
      setCurrentVibe(null);
      setStage("CAMERA");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t remove your Vibe.");
    } finally {
      setBusy(false);
    }
  }, [busy, currentVibe]);

  if (!permissionsGranted && stage === "CAMERA") {
    return (
      <View style={[styles.permissionScreen, { backgroundColor: palette.background }]}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safe}>
          <View style={styles.permissionHeader}>
            <ToolButton icon="close" label="Close" onPress={() => router.back()} />
          </View>
          <View style={styles.permissionContent}>
            <View style={[styles.permissionIcon, { backgroundColor: palette.brandSubdued }]}>
              <Icon name="video" size={28} color={palette.textBrand} filled />
            </View>
            <Text variant="titleSm" align="center">Create your Vibe</Text>
            <Text variant="body" color="textSubdued" align="center">
              Record a 5-second intro. Add a filter, keep your voice, mute it, or use audio you own.
            </Text>
            {error ? <Text variant="caption" color="error" align="center">{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Allow camera and microphone"
              onPress={() => void requestPermissions()}
              style={({ pressed }) => [
                styles.permissionButton,
                { backgroundColor: pressed ? palette.brandDeep : palette.brandStrong },
              ]}
            >
              <Text variant="button" color="textOnBrand">Continue</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.alwaysBlack }]}>
      <StatusBar style="light" />
      {stage === "CAMERA" ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          active={focused}
          facing={facing}
          mirror={facing === "front"}
          mode="video"
          mute={false}
          videoQuality="720p"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(event) => setError(event.message)}
        />
      ) : null}

      {stage === "PREVIEW" && recordedUri ? (
        <VibePlayback
          uri={recordedUri}
          filter={filter}
          audioMode={audioMode}
          music={music}
        />
      ) : null}

      {stage === "CURRENT" ? (
        currentVibe?.status === "READY" && currentVibe.playbackUrl ? (
          <VibePlayback
            uri={currentVibe.playbackUrl}
            filter={currentVibe.filter}
            audioMode={currentVibe.audioMode}
            music={null}
          />
        ) : (
          <ProcessingState vibe={currentVibe} />
        )
      ) : null}

      {overlayToken && stage === "CAMERA" ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: palette[overlayToken] }]}
        />
      ) : null}

      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.topBar}>
          <ToolButton
            icon="close"
            label="Close"
            inverse
            onPress={() => router.back()}
          />
          <View style={[styles.brandPill, { backgroundColor: palette.inkAlpha50 }]}>
            <Text variant="captionStrong" color="textOnBrand">Yariva Vibe</Text>
          </View>
          {stage === "CURRENT" ? (
            <ToolButton
              icon="trash"
              label="Remove Vibe"
              inverse
              disabled={busy || !currentVibe}
              onPress={() => void removeCurrent()}
            />
          ) : stage === "CAMERA" && currentVibe?.status === "READY" ? (
            <ToolButton
              icon="play"
              label="View current Vibe"
              inverse
              onPress={() => setStage("CURRENT")}
            />
          ) : (
            <View style={styles.toolPlaceholder} />
          )}
        </View>

        {stage === "CAMERA" ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Vibe recording progress"
            accessibilityValue={{
              min: 0,
              max: MAX_DURATION_SECONDS,
              now: elapsedMs / 1000,
            }}
            style={[styles.recordTimeline, { backgroundColor: palette.whiteAlpha28 }]}
          >
            <View
              style={[
                styles.recordTimelineFill,
                {
                  backgroundColor: palette.alwaysWhite,
                  width: `${Math.min(1, elapsedMs / (MAX_DURATION_SECONDS * 1000)) * 100}%`,
                },
              ]}
            />
          </View>
        ) : null}

        {filtersVisible && (stage === "CAMERA" || stage === "PREVIEW") ? (
          <FilterPopover
            value={filter}
            disabled={recording || busy}
            preview={stage === "PREVIEW"}
            onChange={(value) => {
              setFilter(value);
              setFiltersVisible(false);
            }}
          />
        ) : null}

        {stage === "CAMERA" ? (
          <>
            <View style={styles.rightRail}>
              <RailButton
                icon="cameraReverse"
                label="Flip"
                onPress={() => setFacing((value) => (value === "front" ? "back" : "front"))}
                disabled={recording}
              />
              <RailButton
                icon="music"
                label={music ? "Change music" : "Add music"}
                onPress={() => void chooseMusic()}
                selected={audioMode === "CUSTOM"}
                disabled={recording}
              />
              <RailButton
                icon="spark"
                label={filtersVisible ? "Hide effects" : "Show effects"}
                onPress={() => setFiltersVisible((visible) => !visible)}
                selected={filtersVisible || filter !== "ORIGINAL"}
                disabled={recording}
              />
              <RailButton
                icon={audioMode === "MUTED" ? "micOff" : "mic"}
                label={audioMode === "MUTED" ? "Restore original audio" : "Mute original audio"}
                onPress={toggleMuted}
                selected={audioMode === "MUTED"}
                disabled={recording}
              />
            </View>

            <View style={styles.cameraBottom}>
              {error ? (
                <View style={[styles.errorPill, { backgroundColor: palette.errorOverlay }]}>
                  <Text variant="caption" color="alwaysWhite" align="center">{error}</Text>
                </View>
              ) : null}
              {audioMode !== "ORIGINAL" ? (
                <ActiveAudioChip
                  label={musicLabel}
                  muted={audioMode === "MUTED"}
                  onClear={audioMode === "CUSTOM" ? clearSelectedMusic : toggleMuted}
                />
              ) : null}
              <View style={styles.captureControls}>
                <View style={[styles.durationPill, { backgroundColor: palette.inkAlpha50 }]}>
                  <Text variant="micro" color="alwaysWhite" weight="700">
                  {recording
                    ? `${Math.max(0, MAX_DURATION_SECONDS - elapsedMs / 1000).toFixed(1)}s`
                    : "5s"}
                  </Text>
                </View>
                <RecordButton
                  recording={recording}
                  disabled={!cameraReady || busy}
                  onPress={recording ? stopRecording : () => void startRecording()}
                />
              </View>
            </View>
          </>
        ) : null}

        {stage === "CURRENT" && currentVibe?.status === "READY" ? (
          <View style={styles.rightRail}>
            <RailButton
              icon="camera"
              label="Replace Vibe"
              onPress={() => setStage("CAMERA")}
            />
          </View>
        ) : null}

        {stage === "PREVIEW" ? (
          <View style={styles.rightRail}>
            <RailButton
              icon="music"
              label={music ? "Change music" : "Add music"}
              selected={audioMode === "CUSTOM"}
              disabled={busy}
              onPress={() => void chooseMusic()}
            />
            <RailButton
              icon="spark"
              label={filtersVisible ? "Hide effects" : "Show effects"}
              selected={filtersVisible || filter !== "ORIGINAL"}
              disabled={busy}
              onPress={() => setFiltersVisible((visible) => !visible)}
            />
            <RailButton
              icon={audioMode === "MUTED" ? "micOff" : "mic"}
              label={audioMode === "MUTED" ? "Restore original audio" : "Mute original audio"}
              selected={audioMode === "MUTED"}
              disabled={busy}
              onPress={toggleMuted}
            />
          </View>
        ) : null}

        {stage === "PREVIEW" ? (
          <View style={styles.previewBottom}>
            {error ? (
              <View style={[styles.errorPill, { backgroundColor: palette.errorOverlay }]}>
                <Text variant="caption" color="alwaysWhite" align="center">{error}</Text>
              </View>
            ) : null}
            {audioMode !== "ORIGINAL" ? (
              <ActiveAudioChip
                label={musicLabel}
                muted={audioMode === "MUTED"}
                onClear={audioMode === "CUSTOM" ? clearSelectedMusic : toggleMuted}
              />
            ) : null}
            <View style={styles.previewActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retake"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={retake}
                style={({ pressed }) => [
                  styles.previewRetake,
                  {
                    backgroundColor: palette.inkAlpha50,
                    borderColor: palette.whiteAlpha42,
                    opacity: busy ? 0.45 : pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Icon name="rewind" size={20} color={palette.alwaysWhite} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={busy ? `Sharing ${Math.round(uploadProgress * 100)}%` : "Share Vibe"}
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void postVibe()}
                style={({ pressed }) => [
                  styles.previewShare,
                  {
                    backgroundColor: pressed ? palette.brandDeep : palette.brandStrong,
                    opacity: busy ? 0.82 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={palette.textOnBrand} />
                ) : (
                  <Icon name="arrowUp" size={18} color={palette.textOnBrand} />
                )}
                <Text variant="button" color="textOnBrand">
                  {busy ? `Sharing ${Math.round(uploadProgress * 100)}%` : "Share Vibe"}
                </Text>
              </Pressable>
            </View>
            {busy ? (
              <View style={[styles.uploadTrack, { backgroundColor: palette.whiteAlpha28 }]}>
                <View
                  style={[
                    styles.uploadFill,
                    { backgroundColor: palette.alwaysWhite, width: `${uploadProgress * 100}%` },
                  ]}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {stage === "CURRENT" && currentVibe?.status !== "READY" ? (
          <View style={styles.currentBottom}>
            {error ? (
              <View style={[styles.errorPill, { backgroundColor: palette.errorOverlay }]}>
                <Text variant="caption" color="alwaysWhite" align="center">{error}</Text>
              </View>
            ) : null}
            <Text variant="heading" color="alwaysWhite" align="center">
              {currentVibe?.status === "FAILED" || currentVibe?.status === "REJECTED"
                ? "Try another Vibe"
                : "Finishing your Vibe"}
            </Text>
            <Text variant="caption" color="alwaysWhite" align="center" style={styles.currentCaption}>
              {currentVibe?.status === "FAILED" || currentVibe?.status === "REJECTED"
                ? currentVibe.failureReason ?? "This Vibe couldn’t be published."
                : "You can leave this screen. It’ll update when processing is complete."}
            </Text>
            <CompactAction
              label="Record another"
              icon="camera"
              disabled={busy || currentVibe?.status === "PROCESSING"}
              onPress={() => {
                setStage("CAMERA");
              }}
            />
          </View>
        ) : null}
      </SafeAreaView>

    </View>
  );
};

const uploadVibeAssets = async (input: {
  initiated: InitiateVibeUploadResponse;
  video: { uri: string; mimeType: string; sizeBytes: number };
  music: LocalMusic | null;
  onProgress: (progress: number) => void;
}): Promise<void> => {
  const hasMusic = Boolean(input.initiated.music && input.music);
  await uploadToPresignedUrl({
    uri: input.video.uri,
    mimeType: input.video.mimeType,
    uploadUrl: input.initiated.video.uploadUrl,
    uploadHeaders: input.initiated.video.headers,
    onProgress: (progress) => input.onProgress(progress * (hasMusic ? 0.72 : 1)),
  });
  if (input.initiated.music && input.music) {
    await uploadToPresignedUrl({
      uri: input.music.uri,
      mimeType: input.music.mimeType,
      uploadUrl: input.initiated.music.uploadUrl,
      uploadHeaders: input.initiated.music.headers,
      onProgress: (progress) => input.onProgress(0.72 + progress * 0.28),
    });
  }
  input.onProgress(1);
};

const VibePlayback: React.FC<{
  uri: string;
  filter: VibeFilter;
  audioMode: VibeAudioMode;
  music: LocalMusic | null;
}> = ({ uri, filter, audioMode, music }) => {
  const { palette } = useTheme();
  const [playing, setPlaying] = useState(false);
  const usesSeparateMusic = audioMode === "CUSTOM" && Boolean(music);
  const videoPlayer = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = audioMode === "MUTED" || usesSeparateMusic;
  });
  const audioPlayer = useAudioPlayer(audioMode === "CUSTOM" ? music?.uri ?? null : null);
  const overlayToken = filterOverlayToken(filter);

  useEffect(() => {
    videoPlayer.muted = audioMode === "MUTED" || usesSeparateMusic;
  }, [audioMode, usesSeparateMusic, videoPlayer]);

  const toggle = () => {
    if (playing) {
      videoPlayer.pause();
      audioPlayer.pause();
      setPlaying(false);
      return;
    }
    videoPlayer.currentTime = 0;
    videoPlayer.play();
    if (audioMode === "CUSTOM" && music) {
      void audioPlayer.seekTo(0).then(() => audioPlayer.play());
    }
    setPlaying(true);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? "Pause Vibe" : "Play Vibe"}
      onPress={toggle}
      style={StyleSheet.absoluteFill}
    >
      <VideoView
        player={videoPlayer}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      {overlayToken ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: palette[overlayToken] }]}
        />
      ) : null}
      {!playing ? (
        <View style={styles.playOverlay}>
          <View style={[styles.playButton, { backgroundColor: palette.whiteAlpha86 }]}>
            <Icon name="play" size={26} color={palette.alwaysInk} filled />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
};

const ProcessingState: React.FC<{ vibe: VibeDto | null }> = ({ vibe }) => {
  const { palette } = useTheme();
  const failed = vibe?.status === "FAILED" || vibe?.status === "REJECTED";
  return (
    <View style={[styles.processing, { backgroundColor: palette.alwaysInk }]}>
      {failed ? (
        <Icon name="warning" size={34} color={palette.error} />
      ) : (
        <ActivityIndicator size="large" color={palette.alwaysWhite} />
      )}
    </View>
  );
};

const FilterPopover: React.FC<{
  value: VibeFilter;
  onChange: (value: VibeFilter) => void;
  disabled: boolean;
  preview?: boolean;
}> = ({ value, onChange, disabled, preview = false }) => {
  const { palette } = useTheme();
  return (
    <View
      style={[
        styles.filterPopover,
        preview ? styles.filterPopoverPreview : null,
        { backgroundColor: palette.inkAlpha50, borderColor: palette.whiteAlpha28 },
      ]}
    >
      {FILTERS.map((item) => {
        const selected = value === item.key;
        const previewToken = filterOverlayToken(item.key);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.filterPopoverRow,
              {
                backgroundColor: selected ? palette.whiteAlpha28 : palette.transparent,
                opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.filterSwatch,
                {
                  backgroundColor: previewToken
                    ? palette[previewToken]
                    : palette.whiteAlpha28,
                  borderColor: selected ? palette.alwaysWhite : palette.whiteAlpha42,
                },
              ]}
            />
            <Text
              variant="captionStrong"
              color="alwaysWhite"
              numberOfLines={1}
              style={styles.filterPopoverLabel}
            >
              {item.label}
            </Text>
            {selected ? <Icon name="check" size={15} color={palette.alwaysWhite} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const RecordButton: React.FC<{
  recording: boolean;
  disabled: boolean;
  onPress: () => void;
}> = ({ recording, disabled, onPress }) => {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? "Stop recording" : "Record Vibe"}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.recordOuter, { borderColor: palette.alwaysWhite, opacity: disabled ? 0.5 : 1 }]}
    >
      <View
        style={[
          recording ? styles.recordStop : styles.recordInner,
          { backgroundColor: palette.like },
        ]}
      />
    </Pressable>
  );
};

const ToolButton: React.FC<{
  icon: IconName;
  label: string;
  inverse?: boolean;
  disabled?: boolean;
  onPress: () => void;
}> = ({ icon, label, inverse = false, disabled = false, onPress }) => {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        {
          backgroundColor: inverse ? palette.inkAlpha50 : palette.surface,
          opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Icon name={icon} size={20} color={inverse ? palette.alwaysWhite : palette.textPrimary} />
    </Pressable>
  );
};

const RailButton: React.FC<{
  icon: IconName;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}> = ({ icon, label, selected = false, disabled = false, onPress }) => {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.railButton, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          styles.railIcon,
          { backgroundColor: selected ? palette.alwaysWhite : palette.inkAlpha50 },
        ]}
      >
        <Icon
          name={icon}
          size={20}
          color={selected ? palette.alwaysInk : palette.alwaysWhite}
          filled={selected}
        />
      </View>
    </Pressable>
  );
};

const ActiveAudioChip: React.FC<{
  label: string;
  muted: boolean;
  onClear: () => void;
}> = ({ label, muted, onClear }) => {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${muted ? "Restore original audio" : "Remove selected music"}. ${label}`}
      onPress={onClear}
      style={({ pressed }) => [
        styles.activeAudio,
        {
          backgroundColor: palette.inkAlpha50,
          borderColor: palette.whiteAlpha42,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Icon name={muted ? "micOff" : "music"} size={15} color={palette.alwaysWhite} />
      <Text variant="captionStrong" color="alwaysWhite" numberOfLines={1} style={styles.activeAudioText}>
        {label}
      </Text>
      <Icon name="close" size={14} color={palette.alwaysWhite} />
    </Pressable>
  );
};

const CompactAction: React.FC<{
  label: string;
  icon: IconName;
  secondary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}> = ({ label, icon, secondary = false, disabled = false, onPress }) => {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactAction,
        {
          backgroundColor: secondary ? palette.inkAlpha50 : palette.alwaysWhite,
          borderColor: secondary ? palette.whiteAlpha42 : palette.alwaysWhite,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Icon
        name={icon}
        size={17}
        color={secondary ? palette.alwaysWhite : palette.alwaysInk}
      />
      <Text variant="button" color={secondary ? "alwaysWhite" : "alwaysInk"}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  permissionScreen: { flex: 1 },
  permissionHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: "flex-start" },
  permissionContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  permissionIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  permissionButton: {
    minHeight: 44,
    minWidth: 180,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  recordTimeline: {
    height: 3,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  recordTimelineFill: { height: "100%", borderRadius: radius.pill },
  brandPill: {
    minHeight: 32,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toolPlaceholder: { width: 40, height: 40 },
  rightRail: {
    position: "absolute",
    right: spacing.md,
    top: 104,
    gap: spacing.md,
  },
  railButton: { width: 44, alignItems: "center" },
  railIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBottom: {
    marginTop: "auto",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  filterPopover: {
    position: "absolute",
    right: 72,
    top: 184,
    width: 142,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.xs,
    gap: spacing.xxs,
  },
  filterPopoverPreview: { right: 72, top: 164 },
  filterPopoverRow: {
    minHeight: 38,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  filterSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  filterPopoverLabel: { flex: 1, minWidth: 0 },
  activeAudio: {
    maxWidth: "78%",
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  activeAudioText: { maxWidth: 190 },
  captureControls: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  durationPill: {
    minWidth: 42,
    height: 24,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  recordOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  recordInner: { width: 56, height: 56, borderRadius: 28 },
  recordStop: { width: 28, height: 28, borderRadius: radius.xs },
  previewBottom: {
    marginTop: "auto",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  previewRetake: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  previewShare: {
    minWidth: 148,
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  compactAction: {
    minHeight: 44,
    flex: 1,
    borderRadius: radius.button,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  uploadTrack: { width: "70%", height: 3, borderRadius: radius.pill, overflow: "hidden" },
  uploadFill: { height: "100%", borderRadius: radius.pill },
  currentBottom: {
    marginTop: "auto",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: "stretch",
    gap: spacing.sm,
  },
  currentCaption: { opacity: 0.86 },
  errorPill: {
    maxWidth: "88%",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  playButton: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  processing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
