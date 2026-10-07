import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { uploadToPresignedUrl } from "../../api/upload";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useAuth } from "../../auth/AuthContext";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { moveProfilePhoto } from "../profile/profileEditForm";
import { spacing } from "../../theme/spacing";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import {
  isProfilePhotoMimeType,
  normalizeUploadFileName,
  PROFILE_PHOTO_MAX_BYTES,
} from "../../types/media";
import type { PrivatePhotoDto } from "../../types/profile";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenPhotos.
// 3-column grid; primary badge, pending overlay (clock + Reviewing…),
// rejected overlay (warning + Couldn't approve), info banner.
export const PhotosScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { setProfileCompletion } = useAuth();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/review");
  const hydration = useProfileHydration();
  const { reload } = hydration;
  const [photos, setPhotos] = useState<PrivatePhotoDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [managing, setManaging] = useState<PrivatePhotoDto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(async () => {
    const me = await reload();
    if (me) {
      setPhotos(me.photos);
      setProfileCompletion(me.completion);
    }
  }, [reload, setProfileCompletion]);

  useEffect(() => {
    if (hydration.profile) {
      setPhotos(hydration.profile.photos);
      setProfileCompletion(hydration.profile.completion);
    }
  }, [hydration.profile, setProfileCompletion]);

  const onPick = async () => {
    if (uploading || photoBusy || photos.length >= 6) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show("Photo permission denied.", "warning");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [3, 4],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!isProfilePhotoMimeType(mimeType)) {
        toast.show("Choose a JPEG, PNG, or WebP photo.", "warning");
        return;
      }
      if (asset.fileSize && asset.fileSize > PROFILE_PHOTO_MAX_BYTES) {
        toast.show("Choose a profile photo smaller than 10 MB.", "warning");
        return;
      }
      setUploading(true);
      const init = await profilesApi.initiatePhotoUpload({
        fileName: normalizeUploadFileName(asset.fileName, `profile-${Date.now()}.jpg`),
        mimeType,
        sizeBytes: asset.fileSize ?? 1,
      });
      await uploadToPresignedUrl({
        uri: asset.uri,
        uploadUrl: init.uploadUrl,
        uploadHeaders: init.headers,
        mimeType,
      });
      const finalized = await profilesApi.finalizePhoto({
        uploadToken: init.uploadToken,
        objectKey: init.objectKey,
        bucket: init.bucket,
        mimeType,
        sizeBytes: asset.fileSize ?? 1,
        width: asset.width,
        height: asset.height,
        position: photos.length,
      });
      setProfileCompletion(finalized.profileCompletion);
      await refresh();
      toast.show("Photo uploaded for review.", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const cells: (PrivatePhotoDto | null)[] = [];
  for (let i = 0; i < 6; i += 1) cells.push(photos[i] ?? null);

  const onContinue = () => flow.complete();
  const manage = async (operation: () => Promise<unknown>) => {
    setPhotoBusy(true);
    try {
      await operation();
      setManaging(null);
      setConfirmRemove(false);
      await refresh();
    } catch {
      toast.show("Couldn’t update this photo.", "error");
    } finally {
      setPhotoBusy(false);
    }
  };
  const move = (direction: -1 | 1) => {
    if (!managing) return;
    const next = moveProfilePhoto(photos, managing.id, direction);
    void manage(() => profilesApi.reorderPhotos({ orderedPhotoIds: next.map((p) => p.id) }));
  };

  if (hydration.loading || hydration.error || !hydration.profile) {
    return (
      <ProfileSectionLoadState
        title={flow.editMode ? "Photos" : "Add a few photos"}
        subtitle={flow.editMode ? "Photos" : "At least one approved photo is needed to start."}
        step={flow.editMode ? undefined : 9}
        total={flow.editMode ? undefined : 9}
        contextLabel={flow.stepLabel}
        loading={hydration.loading}
        error={hydration.error}
        onBack={flow.goBack}
        onRetry={() => void hydration.reload()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <StepHeader
          step={flow.editMode ? undefined : 9}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Photos" : "Add a few photos"}
          subtitle={flow.editMode ? "Photos" : "At least one approved photo is needed to start."}
          onBack={flow.goBack}
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={formLayout.content}>
          <View
            style={styles.grid}
            onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
          >
            {cells.map((p, i) => (
              <PhotoCell
                key={i}
                photo={p}
                slotNumber={i + 1}
                width={gridWidth > 0 ? (gridWidth - 20) / 3 : undefined}
                isPrimary={p?.isPrimary}
                onAdd={onPick}
                uploading={uploading || photoBusy}
                onManage={() => {
                  setManaging(p);
                  setConfirmRemove(false);
                }}
              />
            ))}
          </View>
          {!flow.editMode ? (
            <View style={styles.banner}>
              <Icon name="shield" size={18} color={palette.brandStrong} strokeWidth={1.8} />
              <Text variant="caption" style={{ color: palette.textBrand, lineHeight: 18, flex: 1 }}>
                Photos are reviewed before appearing on your profile.
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <ScreenFooter safeAreaHandled>
          <Button
            label={flow.editMode ? "Done" : "Finish"}
            variant="primary"
            fullWidth
            onPress={onContinue}
            disabled={uploading || photoBusy}
          />
        </ScreenFooter>
      </SafeAreaView>
      <CenterDialog
        visible={managing !== null}
        onClose={() => {
          if (!photoBusy) setManaging(null);
        }}
        accessibilityLabel="Photo options"
        style={{ gap: spacing.md }}
      >
        <Text variant="heading">{confirmRemove ? "Remove this photo?" : "Photo options"}</Text>
        {managing && !confirmRemove ? (
          <>
            {managing.moderationStatus === "APPROVED" && !managing.isPrimary ? (
              <Button
                label="Make primary"
                variant="secondary"
                loading={photoBusy}
                onPress={() => void manage(() => profilesApi.setPrimaryPhoto(managing.id))}
              />
            ) : null}
            {photos.findIndex((p) => p.id === managing.id) > 0 ? (
              <Button
                label="Move earlier"
                variant="ghost"
                disabled={photoBusy}
                onPress={() => move(-1)}
              />
            ) : null}
            {photos.findIndex((p) => p.id === managing.id) < photos.length - 1 ? (
              <Button
                label="Move later"
                variant="ghost"
                disabled={photoBusy}
                onPress={() => move(1)}
              />
            ) : null}
            <Button
              label="Remove photo"
              variant="danger"
              disabled={photoBusy}
              onPress={() => setConfirmRemove(true)}
            />
          </>
        ) : managing ? (
          <Button
            label="Remove"
            variant="danger"
            loading={photoBusy}
            onPress={() => void manage(() => profilesApi.deletePhoto(managing.id))}
          />
        ) : null}
        <Button
          label="Cancel"
          variant="ghost"
          disabled={photoBusy}
          onPress={() => setManaging(null)}
        />
      </CenterDialog>
    </View>
  );
};

const PhotoCell: React.FC<{
  photo: PrivatePhotoDto | null;
  slotNumber: number;
  width?: number;
  isPrimary?: boolean;
  uploading: boolean;
  onAdd: () => void;
  onManage: () => void;
}> = ({ photo, slotNumber, width, isPrimary, uploading, onAdd, onManage }) => {
  const { palette } = useTheme();
  const styles = useStyles();

  if (!photo) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel={`Add profile photo ${slotNumber}`}
        style={[styles.cell, styles.cellEmpty, width ? { width, height: (width * 4) / 3 } : null]}
        accessibilityState={{ disabled: uploading }}
      >
        {uploading ? (
          <Text variant="caption" color="textBrand">
            Uploading…
          </Text>
        ) : (
          <Icon name="plus" size={26} color={palette.brand} strokeWidth={2} />
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onManage}
      accessibilityRole="button"
      disabled={uploading}
      style={[styles.cell, width ? { width, height: (width * 4) / 3 } : null]}
      accessible
      accessibilityLabel={`Profile photo ${slotNumber}, ${
        photo.moderationStatus === "APPROVED"
          ? "approved"
          : photo.moderationStatus === "PENDING"
            ? "under review"
            : "not approved"
      }${isPrimary ? ", primary" : ""}`}
    >
      {photo.url ? (
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.brandTint }]} />
      )}
      {isPrimary ? (
        <View style={styles.primaryTag}>
          <Text variant="micro" style={styles.primaryTagText}>
            PRIMARY
          </Text>
        </View>
      ) : null}
      {photo.moderationStatus === "PENDING" ? (
        <View
          style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: palette.inkAlpha40 }]}
        >
          <Icon name="clock" size={20} color={palette.alwaysWhite} />
          <Text variant="micro" style={styles.overlayText}>
            Reviewing…
          </Text>
        </View>
      ) : null}
      {photo.moderationStatus === "REJECTED" ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            { backgroundColor: palette.errorOverlay },
          ]}
        >
          <Icon name="warning" size={20} color={palette.alwaysWhite} />
          <Text variant="micro" style={styles.overlayText}>
            Couldn’t approve
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cell: {
    width: "30.8%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: palette.alwaysBlack,
  },
  cellEmpty: {
    backgroundColor: palette.brandSubdued,
    borderWidth: 1.5,
    borderColor: palette.brandBorder,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTag: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
    backgroundColor: palette.brandStrong,
  },
  primaryTagText: {
    color: palette.alwaysWhite,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  overlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 6,
  },
  overlayText: {
    color: palette.alwaysWhite,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  banner: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: palette.brandSubdued,
    marginTop: 16,
  },
}));
