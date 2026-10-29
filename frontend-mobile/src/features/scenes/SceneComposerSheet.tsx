import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, View } from "react-native";
import { profilesApi } from "../../api/endpoints/profiles";
import { uploadToPresignedUrl } from "../../api/upload";
import { SegmentedControl } from "../../components/dating";
import { Button } from "../../components/ui/Button";
import { Icon, type IconName } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { controlSize, layout, radius, spacing } from "../../theme/spacing";
import {
  isProfilePhotoMimeType,
  normalizeUploadFileName,
  PROFILE_PHOTO_MAX_BYTES,
} from "../../types/media";
import type { PrivatePhotoDto } from "../../types/profile";
import type { SceneDto, SceneInput, SceneIntent } from "../../types/scenes";

import { sceneAvailability, type AvailabilityChoice } from "./sceneTime";
type PhotoSource = "camera" | "gallery";
type ScenePhoto = Pick<PrivatePhotoDto, "id" | "url">;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const SceneComposerSheet: React.FC<{
  visible: boolean;
  scene: SceneDto | null;
  busy: boolean;
  canPublish: boolean;
  error: string | null;
  lifetimeHours: number;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onSubmit: (input: SceneInput) => void;
}> = ({
  visible,
  scene,
  busy,
  canPublish,
  error,
  lifetimeHours,
  onDirtyChange,
  onBusyChange,
  onSubmit,
}) => {
  const { t } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  const [intent, setIntent] = useState<SceneIntent>(scene?.intent ?? "DATING");
  const [activity, setActivity] = useState(scene?.activity ?? "");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(scene?.photo?.id ?? null);
  const [uploadedPhoto, setUploadedPhoto] = useState<ScenePhoto | null>(null);
  const [availability, setAvailability] = useState<AvailabilityChoice>("FLEXIBLE");
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeChanged, setTimeChanged] = useState(false);
  const [progress, setProgress] = useState(0);
  const alive = useRef(true);
  const picking = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setIntent(scene?.intent ?? "DATING");
    setActivity(scene?.activity ?? "");
    setSelectedPhotoId(scene?.photo?.id ?? null);
    setUploadedPhoto(null);
    setAvailability("FLEXIBLE");
    setTimeChanged(false);
    setTimeOpen(false);
    setUploadError(null);
  }, [scene]);

  const currentPhoto =
    uploadedPhoto ?? (scene?.photo && selectedPhotoId === scene.photo.id ? scene.photo : null);
  const formBusy = busy || uploading;
  const canSubmit = activity.trim().length >= 2 && canPublish && !formBusy;

  const dirty =
    activity !== (scene?.activity ?? "") ||
    intent !== (scene?.intent ?? "DATING") ||
    selectedPhotoId !== (scene?.photo?.id ?? null) ||
    timeChanged;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(uploading);
  }, [uploading, onBusyChange]);

  const intentOptions = useMemo(
    () => [
      { value: "DATING" as const, label: t("scene.intent.dating") },
      { value: "FRIENDSHIP" as const, label: t("scene.intent.friendship") },
      { value: "CASUAL_HANG" as const, label: t("scene.intent.casualHang") },
    ],
    [t],
  );
  const availabilityOptions = useMemo(
    () => [
      { value: "FLEXIBLE" as const, label: t("scene.availability.flexible") },
      { value: "NEXT_TWO_HOURS" as const, label: t("scene.availability.nextTwoHours") },
      { value: "TONIGHT" as const, label: t("scene.availability.tonight") },
    ],
    [t],
  );

  const pollUntilReviewed = async (photo: PrivatePhotoDto): Promise<PrivatePhotoDto> => {
    let latest = photo;
    for (
      let attempt = 0;
      alive.current && attempt < 30 && latest.moderationStatus === "PENDING";
      attempt += 1
    ) {
      await wait(500);
      if (!alive.current || AppState.currentState !== "active") break;
      latest = await profilesApi.photo(photo.id);
    }
    return latest;
  };

  const pickPhoto = async (source: PhotoSource) => {
    if (formBusy || picking.current) return;
    picking.current = true;
    setProgress(0);
    setUploading(true);
    setUploadError(null);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setUploadError(t(`scene.photo.${source}Permission`));
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.9,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || !alive.current || AppState.currentState !== "active") return;
      const asset = result.assets[0];
      if (!asset) return;

      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!isProfilePhotoMimeType(mimeType)) {
        setUploadError(t("scene.photo.typeError"));
        return;
      }
      const sizeBytes = new File(asset.uri).size || asset.fileSize || 0;
      if (!sizeBytes || sizeBytes > PROFILE_PHOTO_MAX_BYTES) {
        setUploadError(t("scene.photo.sizeError"));
        return;
      }

      const initiated = await profilesApi.initiatePhotoUpload({
        fileName: normalizeUploadFileName(asset.fileName, `scene-${Date.now()}.jpg`),
        mimeType,
        sizeBytes,
        purpose: "SCENE",
      });
      if (!alive.current || AppState.currentState !== "active") return;
      await uploadToPresignedUrl({
        uri: asset.uri,
        uploadUrl: initiated.uploadUrl,
        uploadHeaders: initiated.headers,
        mimeType,
        onProgress: (value) => {
          if (alive.current) setProgress(value);
        },
      });
      if (!alive.current || AppState.currentState !== "active") return;
      const finalized = await profilesApi.finalizePhoto({
        uploadToken: initiated.uploadToken,
        objectKey: initiated.objectKey,
        bucket: initiated.bucket,
        mimeType,
        sizeBytes,
        width: asset.width,
        height: asset.height,
        position: 0,
      });
      const reviewed = await pollUntilReviewed(finalized.photo);
      if (!alive.current || AppState.currentState !== "active") return;
      if (reviewed.moderationStatus === "REJECTED") {
        setUploadError(t("scene.photo.rejected"));
        return;
      }
      if (reviewed.moderationStatus !== "APPROVED") {
        setUploadError(t("scene.photo.processing"));
        return;
      }
      setUploadedPhoto(reviewed);
      setSelectedPhotoId(reviewed.id);
    } catch {
      if (alive.current) setUploadError(t("scene.photo.uploadError"));
    } finally {
      picking.current = false;
      if (alive.current) setUploading(false);
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    const { availableFrom, availableUntil } = sceneAvailability(
      scene,
      timeChanged ? availability : null,
      Date.now(),
      lifetimeHours,
    );
    onSubmit({
      intent,
      activity: activity.trim(),
      photoId: selectedPhotoId,
      tags: scene?.tags ?? [],
      availableFrom,
      availableUntil,
    });
  };

  return (
    <View
      style={[styles.root, !visible && styles.hidden]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.mediaCard}>
          {currentPhoto ? (
            <Image
              source={currentPhoto.url}
              contentFit="cover"
              transition={140}
              style={styles.mediaPreview}
              accessibilityLabel={t("scene.photo.label")}
            />
          ) : null}
          <View style={styles.mediaControls}>
            <Text variant="captionStrong">
              {currentPhoto ? t("scene.photo.change") : t("scene.photo.add")}
            </Text>
            <View style={styles.mediaActions}>
              <PhotoAction
                icon="camera"
                label={t("scene.photo.camera")}
                disabled={formBusy}
                onPress={() => void pickPhoto("camera")}
              />
              <PhotoAction
                icon="image"
                label={t("scene.photo.gallery")}
                disabled={formBusy}
                onPress={() => void pickPhoto("gallery")}
              />
            </View>
            {uploading ? (
              <View style={styles.uploadState} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={palette.brand} />
                <Text variant="micro" color="textSubdued">
                  {`${t("scene.photo.uploading")} ${Math.round(progress * 100)}%`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {uploadError ? (
          <Text variant="caption" color="error" accessibilityRole="alert">
            {uploadError}
          </Text>
        ) : null}

        <Input
          label={t("scene.activity.label")}
          placeholder={t("scene.activity.placeholder")}
          value={activity}
          onChangeText={setActivity}
          maxLength={120}
          multiline
          style={styles.activityInput}
          editable={!formBusy}
          error={
            activity.length > 0 && activity.trim().length < 2 ? t("scene.activity.error") : null
          }
        />

        <View style={styles.fieldGroup}>
          <Text variant="captionStrong" color="textSubdued">
            {t("scene.intent.label")}
          </Text>
          <SegmentedControl
            value={intent}
            options={intentOptions}
            onChange={setIntent}
            disabled={formBusy}
            accessibilityLabel={t("scene.intent.label")}
            variant="underline"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("composer.time")}
          accessibilityState={{ expanded: timeOpen }}
          disabled={formBusy}
          onPress={() => setTimeOpen((value) => !value)}
          style={styles.timeControl}
        >
          <Icon name="clock" size={18} color={palette.textSubdued} />
          <Text variant="captionStrong" style={{ flex: 1 }}>
            {t("composer.time")}
          </Text>
          <Text variant="caption" color="textSubdued">
            {!timeChanged && scene?.availableUntil
              ? new Date(scene.availableUntil).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : availabilityOptions.find((option) => option.value === availability)?.label}
          </Text>
          <Icon name="chevronDown" size={16} color={palette.textSubdued} />
        </Pressable>
        {timeOpen ? (
          <SegmentedControl
            value={availability}
            options={availabilityOptions}
            onChange={(value) => {
              setAvailability(value);
              setTimeChanged(true);
            }}
            disabled={formBusy}
            accessibilityLabel={t("scene.availability.label")}
            variant="underline"
          />
        ) : null}

        {error ? (
          <Text variant="caption" color="error" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Text variant="caption" color="textSubdued">
          {t("composer.sceneVisibility", { hours: lifetimeHours })}
        </Text>
        <Button
          label={scene ? t("common.save") : t("scene.create")}
          fullWidth
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />
      </View>
    </View>
  );
};

const PhotoAction: React.FC<{
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}> = ({ icon, label, disabled, onPress }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.mediaAction}>
      <IconButton
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        size={40}
        tone="neutral"
      >
        <Icon name={icon} size={22} color={palette.textPrimary} />
      </IconButton>
      <Text variant="micro" color="textSubdued">
        {label}
      </Text>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  root: { flex: 1 },
  hidden: { display: "none" },
  timeControl: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  content: {
    width: "100%",
    maxWidth: layout.formMaxWidth,
    alignSelf: "center",
    gap: spacing.md,
    paddingHorizontal: layout.compactScreenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  mediaCard: {
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  mediaPreview: { width: "100%", aspectRatio: 4 / 3, maxHeight: 280 },
  activityInput: { minHeight: 56, maxHeight: 120 },
  mediaControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  mediaActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  mediaAction: { alignItems: "center", gap: spacing.xs },
  uploadState: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  fieldGroup: { gap: spacing.xs },
  footer: {
    width: "100%",
    maxWidth: layout.formMaxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.compactScreenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.borderSubdued,
  },
}));
