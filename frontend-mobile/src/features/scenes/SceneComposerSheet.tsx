import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { profilesApi } from "../../api/endpoints/profiles";
import { uploadToPresignedUrl } from "../../api/upload";
import { SegmentedControl } from "../../components/dating";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Icon, type IconName } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import {
  isProfilePhotoMimeType,
  normalizeUploadFileName,
  PROFILE_PHOTO_MAX_BYTES,
} from "../../types/media";
import type { PrivatePhotoDto } from "../../types/profile";
import type { SceneDto, SceneInput, SceneIntent } from "../../types/scenes";

type AvailabilityChoice = "FLEXIBLE" | "NEXT_TWO_HOURS" | "TONIGHT";
type PhotoSource = "camera" | "gallery";
type ScenePhoto = Pick<PrivatePhotoDto, "id" | "url">;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const SceneComposerSheet: React.FC<{
  visible: boolean;
  scene: SceneDto | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: SceneInput) => void;
}> = ({ visible, scene, busy, error, onClose, onSubmit }) => {
  const { t } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  const [intent, setIntent] = useState<SceneIntent>(scene?.intent ?? "DATING");
  const [activity, setActivity] = useState(scene?.activity ?? "");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(scene?.photo?.id ?? null);
  const [uploadedPhoto, setUploadedPhoto] = useState<ScenePhoto | null>(null);
  const [availability, setAvailability] = useState<AvailabilityChoice>("FLEXIBLE");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setIntent(scene?.intent ?? "DATING");
    setActivity(scene?.activity ?? "");
    setSelectedPhotoId(scene?.photo?.id ?? null);
    setUploadedPhoto(null);
    setAvailability(scene?.availableUntil ? "NEXT_TWO_HOURS" : "FLEXIBLE");
    setUploadError(null);
  }, [scene, visible]);

  const currentPhoto =
    uploadedPhoto ??
    (scene?.photo && selectedPhotoId === scene.photo.id ? scene.photo : null);
  const formBusy = busy || uploading;
  const canSubmit = activity.trim().length >= 2 && !formBusy;

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
    for (let attempt = 0; attempt < 30 && latest.moderationStatus === "PENDING"; attempt += 1) {
      await wait(500);
      latest = await profilesApi.photo(photo.id);
    }
    return latest;
  };

  const pickPhoto = async (source: PhotoSource) => {
    if (formBusy) return;
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
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!isProfilePhotoMimeType(mimeType)) {
        setUploadError(t("scene.photo.typeError"));
        return;
      }
      if (asset.fileSize && asset.fileSize > PROFILE_PHOTO_MAX_BYTES) {
        setUploadError(t("scene.photo.sizeError"));
        return;
      }

      const sizeBytes = asset.fileSize ?? 1;
      const initiated = await profilesApi.initiatePhotoUpload({
        fileName: normalizeUploadFileName(asset.fileName, `scene-${Date.now()}.jpg`),
        mimeType,
        sizeBytes,
        purpose: "SCENE",
      });
      await uploadToPresignedUrl({
        uri: asset.uri,
        uploadUrl: initiated.uploadUrl,
        uploadHeaders: initiated.headers,
        mimeType,
      });
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
      setUploadError(t("scene.photo.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    const now = new Date();
    const sceneExpiry = scene ? Date.parse(scene.expiresAt) : Number.POSITIVE_INFINITY;
    let availableFrom: string | null = null;
    let availableUntil: string | null = null;
    if (availability !== "FLEXIBLE" && sceneExpiry > now.getTime() + 60_000) {
      availableFrom = now.toISOString();
      const twoHours = new Date(now.getTime() + 2 * 60 * 60_000);
      if (availability === "NEXT_TWO_HOURS") {
        availableUntil = new Date(Math.min(twoHours.getTime(), sceneExpiry - 1_000)).toISOString();
      } else {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 30, 0, 0);
        availableUntil = new Date(
          Math.min(
            sceneExpiry - 1_000,
            Math.max(
              now.getTime() + 30 * 60_000,
              Math.min(endOfDay.getTime(), now.getTime() + 8 * 60 * 60_000),
            ),
          ),
        ).toISOString();
      }
    }
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
    <CenterDialog
      visible={visible}
      onClose={formBusy ? () => undefined : onClose}
      accessibilityLabel={scene ? t("scene.edit") : t("scene.create")}
      closeAccessibilityLabel={t("common.cancel")}
      style={styles.dialog}
    >
      <View style={styles.header}>
        <Text variant="titleSm">{scene ? t("scene.edit") : t("scene.create")}</Text>
        <IconButton
          size={32}
          tone="ghost"
          onPress={onClose}
          disabled={formBusy}
          accessibilityLabel={t("common.cancel")}
        >
          <Icon name="close" size={20} color={palette.textPrimary} />
        </IconButton>
      </View>

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
                  {t("scene.photo.uploading")}
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
          editable={!formBusy}
          error={activity.length > 0 && activity.trim().length < 2 ? t("scene.activity.error") : null}
        />

        <View style={styles.fieldGroup}>
          <Text variant="captionStrong" color="textSubdued" style={styles.fieldLabel}>
            {t("scene.intent.label")}
          </Text>
          <SegmentedControl
            value={intent}
            options={intentOptions}
            onChange={setIntent}
            disabled={formBusy}
            accessibilityLabel={t("scene.intent.label")}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text variant="captionStrong" color="textSubdued" style={styles.fieldLabel}>
            {t("scene.availability.label")}
          </Text>
          <SegmentedControl
            value={availability}
            options={availabilityOptions}
            onChange={setAvailability}
            disabled={formBusy}
            accessibilityLabel={t("scene.availability.label")}
          />
        </View>

        {error ? (
          <Text variant="caption" color="error" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={scene ? t("common.save") : t("scene.create")}
          size="sm"
          fullWidth
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />
      </View>
    </CenterDialog>
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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.mediaAction,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon name={icon} size={19} color={palette.textBrand} />
      <Text variant="captionStrong" color="textBrand" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  dialog: {
    maxHeight: "82%",
    padding: 0,
    overflow: "hidden",
  },
  header: {
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSubdued,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  mediaCard: {
    minHeight: 104,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceSubdued,
  },
  mediaPreview: { width: 78, alignSelf: "stretch" },
  mediaControls: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  mediaActions: { flexDirection: "row", gap: spacing.sm },
  mediaAction: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  uploadState: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { textTransform: "uppercase", letterSpacing: 0.8 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.borderSubdued,
  },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
}));
