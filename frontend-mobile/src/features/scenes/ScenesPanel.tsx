import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { scenesApi } from "../../api/endpoints/scenes";
import { privateStoriesApi, type Story } from "../../api/endpoints/privateStories";
import { ApiError } from "../../api/errors";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { Icon } from "../../components/ui/Icon";
import { Skeleton } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type { SceneCandidateDto, SceneCapabilitiesDto, SceneDto } from "../../types/scenes";
import type { PrivatePhotoDto } from "../../types/profile";
import { PrivateStoryTiles, usePrivateStoryRail } from "../privateStories/PrivateStoriesRail";
import { PrivateStoryViewer } from "../privateStories/PrivateStoryViewer";
import { SceneViewer } from "./SceneViewer";
import { sceneMineAction, sceneRemainingLabel } from "./sceneTime";

export const ScenesPanel: React.FC<{
  photos?: PrivatePhotoDto[];
  ownerName?: string;
}> = ({ photos = [], ownerName }) => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();
  const { t } = useLocalization();
  const [capabilities, setCapabilities] = useState<SceneCapabilitiesDto | null>(null);
  const [storyAvailability, setStoryAvailability] = useState<
    "loading" | "enabled" | "disabled" | "unavailable"
  >("loading");
  const [scene, setScene] = useState<SceneDto | null>(null);
  const [candidates, setCandidates] = useState<SceneCandidateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locationRequired, setLocationRequired] = useState(false);
  const [ownerChoicesOpen, setOwnerChoicesOpen] = useState(false);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [renewReviewOpen, setRenewReviewOpen] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const now = useCurrentTime();
  const privateRail = usePrivateStoryRail(storyAvailability === "enabled");
  const ownStory = storyAvailability === "enabled" ? (privateRail.mine[0] ?? null) : null;
  const ownerScene = capabilities?.enabled ? scene : null;

  const effectiveStatus = useMemo(
    () =>
      scene?.status === "ACTIVE" && Date.parse(scene.expiresAt) <= now ? "EXPIRED" : scene?.status,
    [now, scene],
  );
  const active = effectiveStatus === "ACTIVE";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLocationRequired(false);
    const [sceneResult, storyResult] = await Promise.allSettled([
      scenesApi.capabilities(),
      privateStoriesApi.capabilities(),
    ]);
    setStoryAvailability(
      storyResult.status === "rejected"
        ? "unavailable"
        : storyResult.value.enabled
          ? "enabled"
          : "disabled",
    );
    try {
      if (sceneResult.status === "rejected") throw sceneResult.reason;
      const nextCapabilities = sceneResult.value;
      setCapabilities(nextCapabilities);
      if (!nextCapabilities.enabled) {
        setScene(null);
        setCandidates([]);
        return;
      }
      const mine = await scenesApi.mine();
      setScene(mine.scene);
      if (mine.scene?.status === "ACTIVE" && Date.parse(mine.scene.expiresAt) > Date.now()) {
        const page = await scenesApi.discover(undefined, 10);
        setCandidates(page.items);
      } else {
        setCandidates([]);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "SCENE_LOCATION_REQUIRED") {
        setLocationRequired(true);
      } else {
        setLoadError(t("scene.offline.body"));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const end = async (): Promise<boolean> => {
    if (!scene || saving) return false;
    setSaving(true);
    setLoadError(null);
    try {
      const response = await scenesApi.end(scene.id);
      setScene(response.scene);
      setCandidates([]);
      return true;
    } catch {
      setLoadError(t("scene.offline.body"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const renew = async () => {
    if (!scene || saving) return;
    setSaving(true);
    setLoadError(null);
    setRenewError(null);
    try {
      const response = await scenesApi.renew(scene.id);
      setScene(response.scene);
      setRenewReviewOpen(false);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.code === "SCENE_LOCATION_REQUIRED") {
        setLocationRequired(true);
      } else {
        setRenewError(t("scene.offline.body"));
      }
    } finally {
      setSaving(false);
    }
  };

  const openMine = () => {
    if (saving || !scene) return;
    const action = sceneMineAction(scene, Date.now());
    if (action === "VIEW") setViewerOpen(true);
    else {
      setRenewError(null);
      setRenewReviewOpen(true);
    }
  };

  const openComposer = (
    mode: "story" | "scene" = storyAvailability === "enabled" ? "story" : "scene",
  ) => {
    if (saving) return;
    router.push({ pathname: "/(app)/private-stories", params: { compose: "1", mode } });
  };

  const openOwner = () => {
    if (ownerScene && ownStory) setOwnerChoicesOpen(true);
    else if (ownerScene) openMine();
    else if (ownStory) setOpenStoryId(ownStory.id);
    else openComposer();
  };

  const openOwnStory = () => {
    if (!ownStory) return;
    setOwnerChoicesOpen(false);
    setOpenStoryId(ownStory.id);
  };

  const ownerPhoto = photos.find((photo) => photo.isPrimary) ?? photos[0];

  if (loading && !capabilities && storyAvailability === "loading") {
    return (
      <View style={styles.section}>
        <Text variant="subheading" style={styles.sectionTitle}>
          {t("scene.rail.title")}
        </Text>
        <View style={styles.skeletonRail}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={styles.skeletonItem}>
              <Skeleton width={64} height={64} borderRadius={32} />
              <Skeleton width={58} height={10} borderRadius={5} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Text variant="subheading" style={styles.sectionTitle}>
        {t("scene.rail.title")}
      </Text>
      {loadError ? (
        <View style={styles.stateSurface} accessibilityRole="alert">
          <View style={styles.stateCopy}>
            <Text variant="bodyStrong">{t("scene.offline.title")}</Text>
            <Text variant="caption" color="textSubdued" numberOfLines={2}>
              {loadError}
            </Text>
          </View>
          <Button
            label={t("common.retry")}
            variant="secondary"
            size="sm"
            onPress={() => void load()}
          />
        </View>
      ) : null}
      {locationRequired && !loadError ? (
        <View style={styles.stateSurface} accessibilityRole="alert">
          <View style={styles.locationIcon}>
            <Icon name="location" size={19} color={palette.warning} filled />
          </View>
          <View style={styles.stateCopy}>
            <Text variant="bodyStrong">{t("scene.location.title")}</Text>
            <Text variant="caption" color="textSubdued" numberOfLines={3}>
              {t("scene.location.body")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/settings/edit-profile")}
            accessibilityRole="button"
            accessibilityLabel={t("scene.location.action")}
            style={({ pressed }) => [styles.arrowButton, pressed ? styles.pressed : null]}
          >
            <Icon name="chevronRight" size={20} color={palette.textPrimary} />
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        accessibilityLabel={t("scene.rail.title")}
      >
        <OwnerTile
          scene={ownerScene}
          hasStory={!!ownStory}
          active={active}
          now={now}
          busy={saving}
          photoUrl={ownerPhoto?.url}
          onOpen={openOwner}
          onCreate={() => openComposer()}
        />
        {storyAvailability === "enabled" ? (
          <PrivateStoryTiles
            items={privateRail.items}
            loadError={privateRail.loadError}
            onOpen={(story: Story) => setOpenStoryId(story.id)}
            onRetry={privateRail.retry}
          />
        ) : null}
        {capabilities?.enabled && active && loading
          ? [0, 1, 2].map((item) => (
              <View key={item} style={styles.skeletonItem}>
                <Skeleton width={64} height={64} borderRadius={32} />
                <Skeleton width={58} height={10} borderRadius={5} />
              </View>
            ))
          : (capabilities?.enabled && active ? candidates : []).map((candidate) => (
              <CandidateTile
                key={candidate.scene.id}
                candidate={candidate}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/profile/[userId]",
                    params: { userId: candidate.profile.userId, sceneView: "1" },
                  })
                }
              />
            ))}
      </ScrollView>
      {storyAvailability === "disabled" ? (
        <View style={styles.emptyRow}>
          <Icon name="lock" size={16} color={palette.textSubdued} />
          <Text variant="caption" color="textSubdued" style={styles.emptyText}>
            {t("story.rail.unavailable")}
          </Text>
        </View>
      ) : storyAvailability === "unavailable" ? (
        <View style={styles.emptyRow}>
          <Text variant="caption" color="textSubdued" style={styles.emptyText}>
            {t("story.rail.loadError")}
          </Text>
          <Button label={t("common.retry")} variant="ghost" size="sm" onPress={() => void load()} />
        </View>
      ) : null}

      <CenterDialog
        visible={ownerChoicesOpen}
        onClose={() => setOwnerChoicesOpen(false)}
        accessibilityLabel={t("create.yourUpdates")}
      >
        <View style={styles.createChoices}>
          <Text variant="titleSm">{t("create.yourUpdates")}</Text>
          <CreateChoice
            icon="location"
            label={t("create.viewPlan")}
            description={t("create.planHint")}
            disabled={false}
            onPress={() => {
              setOwnerChoicesOpen(false);
              openMine();
            }}
          />
          <CreateChoice
            icon="lock"
            label={t("create.viewStory")}
            description={t("create.privateHint")}
            disabled={false}
            onPress={openOwnStory}
          />
          <Button
            label={t("common.cancel")}
            variant="ghost"
            onPress={() => setOwnerChoicesOpen(false)}
          />
        </View>
      </CenterDialog>

      <PrivateStoryViewer
        storyId={openStoryId}
        onClose={() => setOpenStoryId(null)}
        canReport={!!openStoryId && !privateRail.mine.some((story) => story.id === openStoryId)}
      />

      <Modal
        visible={viewerOpen && active && scene !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setViewerOpen(false)}
      >
        {scene && active ? (
          <SceneViewer
            identity={{
              displayName: ownerName?.trim() || t("scene.mine"),
              photoUrl: ownerPhoto?.url ?? null,
            }}
            scene={scene}
            mode="owner"
            busy={saving}
            onClose={() => setViewerOpen(false)}
            onEdit={() => {
              setViewerOpen(false);
              openComposer("scene");
            }}
            onEnd={() => {
              void end().then((ended) => {
                if (ended) setViewerOpen(false);
              });
            }}
          />
        ) : null}
      </Modal>

      <CenterDialog
        visible={renewReviewOpen}
        onClose={() => {
          if (!saving) setRenewReviewOpen(false);
        }}
        accessibilityLabel={t("scene.renewReview")}
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="titleSm">{t("scene.renew")}</Text>
          {scene?.photo?.url ? <Avatar uri={scene.photo.url} initials="Me" size={80} /> : null}
          <Text variant="bodyStrong">{scene?.activity}</Text>
          {scene ? (
            <Text variant="caption" color="textSubdued">
              {t(
                `scene.intent.${{ DATING: "dating", FRIENDSHIP: "friendship", CASUAL_HANG: "casualHang" }[scene.intent]}`,
              )}
            </Text>
          ) : null}
          <Text variant="caption" color="textSubdued">
            {t("scene.renewAvailability")}
          </Text>
          <Text variant="caption" color="textSubdued">
            {t("scene.renewHint")}
          </Text>
          {renewError ? (
            <Text color="error" accessibilityRole="alert">
              {renewError}
            </Text>
          ) : null}
          <Button label={t("scene.renew")} loading={saving} onPress={() => void renew()} />
          <Button
            label={t("scene.createDifferent")}
            variant="ghost"
            disabled={saving}
            onPress={() => {
              setRenewReviewOpen(false);
              openComposer("scene");
            }}
          />
        </View>
      </CenterDialog>
    </View>
  );
};

const CreateChoice: React.FC<{
  icon: "location" | "lock";
  label: string;
  description: string;
  disabled: boolean;
  onPress: () => void;
}> = ({ icon, label, description, disabled, onPress }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.createChoice,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.choiceIcon}>
        <Icon name={icon} size={21} color={palette.textBrand} />
      </View>
      <View style={styles.choiceCopy}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" color="textSubdued">
          {description}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={palette.textSubdued} />
    </Pressable>
  );
};

const OwnerTile: React.FC<{
  scene: SceneDto | null;
  hasStory: boolean;
  active: boolean;
  now: number;
  busy: boolean;
  photoUrl?: string;
  onOpen: () => void;
  onCreate: () => void;
}> = ({ scene, hasStory, active, now, busy, photoUrl, onOpen, onCreate }) => {
  const { t } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <View style={styles.ownerCircle}>
        <Pressable
          onPress={scene || hasStory ? onOpen : onCreate}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={
            scene && hasStory
              ? t("create.yourUpdates")
              : scene
                ? active
                  ? t("scene.viewMine")
                  : t("scene.renewReview")
                : hasStory
                  ? t("create.viewStory")
                  : t("create.action")
          }
          style={({ pressed }) => [
            styles.mineRing,
            active || hasStory ? styles.activeRing : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <View style={styles.mineCore}>
            {scene?.photo?.url || photoUrl ? (
              <Avatar uri={scene?.photo?.url ?? photoUrl} initials="Me" size={60} />
            ) : (
              <Icon
                name={scene ? "clock" : hasStory ? "lock" : "user"}
                size={24}
                color={palette.textBrand}
                filled
              />
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={onCreate}
          disabled={busy}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("create.action")}
          style={({ pressed }) => [styles.createBadge, pressed ? styles.pressed : null]}
        >
          <Icon name="plus" size={14} color={palette.alwaysWhite} />
        </Pressable>
      </View>
      <Text variant="captionStrong" numberOfLines={1} align="center">
        {scene && hasStory
          ? t("create.yourUpdates")
          : scene
            ? t("scene.mine")
            : hasStory
              ? t("create.yourStory")
              : t("create.action")}
      </Text>
      {active && scene ? (
        <Text variant="micro" color="textSubdued" numberOfLines={1} align="center">
          {sceneRemainingLabel(scene.expiresAt, now)}
        </Text>
      ) : null}
    </View>
  );
};

const CandidateTile: React.FC<{ candidate: SceneCandidateDto; onPress: () => void }> = ({
  candidate,
  onPress,
}) => {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${candidate.profile.displayName}, ${candidate.scene.activity}`}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
    >
      <View style={styles.candidateRing}>
        <Avatar
          uri={candidate.scene.photo?.url ?? candidate.profile.photoUrl}
          initials={candidate.profile.displayName}
          size={58}
        />
        {candidate.availability === "CONFIRMED" ? <View style={styles.availabilityDot} /> : null}
      </View>
      <Text variant="captionStrong" numberOfLines={1} align="center">
        {candidate.profile.displayName}
      </Text>
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  section: { gap: spacing.xs },
  sectionTitle: { marginHorizontal: spacing.lg },
  rail: { gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tile: { width: 76, minHeight: 88, alignItems: "center", gap: spacing.xxs },
  createChoices: { gap: spacing.md },
  createChoice: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSubdued,
    backgroundColor: palette.surfaceSubdued,
  },
  choiceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.brandSubdued,
  },
  choiceCopy: { flex: 1, gap: spacing.xxs },
  disabled: { opacity: 0.54 },
  ownerCircle: { width: 68, height: 68 },
  createBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.background,
    backgroundColor: palette.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  mineRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
  },
  activeRing: { borderColor: palette.brandSecondary, borderWidth: 2 },
  mineCore: {
    flex: 1,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.brandSubdued,
  },
  candidateRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.brand,
  },
  availabilityDot: {
    position: "absolute",
    right: 1,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.success,
    borderWidth: 2,
    borderColor: palette.background,
  },
  skeletonRail: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.md },
  skeletonItem: { width: 76, gap: spacing.sm, alignItems: "center" },
  stateSurface: {
    minHeight: 76,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.surfaceSubdued,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderSubdued,
  },
  stateCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  locationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.warningSubdued,
  },
  arrowButton: {
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  emptyRow: {
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  emptyText: { flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
}));
