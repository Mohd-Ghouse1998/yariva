import { Image } from "expo-image";
import { isProtectedPhotoSource } from "../blind/protectedPhoto";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { analyticsApi } from "../../api/endpoints/analytics";
import { likesApi } from "../../api/endpoints/likes";
import { profilesApi } from "../../api/endpoints/profiles";
import { scenesApi } from "../../api/endpoints/scenes";
import { safetyApi } from "../../api/endpoints/safety";
import { vibesApi } from "../../api/endpoints/vibes";
import {
  CompatibilitySummary,
  ResponsiveBottomAction,
  VerificationBadge,
} from "../../components/dating";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Chip } from "../../components/ui/Chip";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { IntentBadge } from "../../components/ui/IntentBadge";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { Skeleton } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useResponsiveLayout } from "../../theme/responsive";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { layout, radius, spacing } from "../../theme/spacing";
import type { PublicProfileDto } from "../../types/profile";
import type { SceneDto } from "../../types/scenes";
import type { VibeDto } from "../../types/vibe";
import { useLocalization } from "../../localization/LocalizationContext";
import { formatDistance } from "../../utils/format";
import { profilePromptLabel } from "../profile/profilePrompts";
import { BlockConfirmModal } from "../safety/BlockConfirmModal";
import { SceneViewer } from "../scenes/SceneViewer";
import { VibeProfilePreview } from "../vibes/VibeProfilePreview";
import { classifyProfileLoadFailure, type ProfileLoadFailure } from "./profileLoadFailure";

import { humanizeProfileValue as humanize } from "../../utils/format";

const PROFILE_FAILURE_COPY: Record<
  ProfileLoadFailure,
  { title: string; body: string; retry: boolean }
> = {
  offline: {
    title: "You’re offline",
    body: "Reconnect and try loading this profile again.",
    retry: true,
  },
  "not-found": {
    title: "Profile no longer available",
    body: "This person may have deleted or deactivated their profile.",
    retry: false,
  },
  blocked: {
    title: "Profile can’t be viewed",
    body: "This profile isn’t available to you.",
    retry: false,
  },
  unavailable: {
    title: "Profile temporarily unavailable",
    body: "We couldn’t load this profile right now. Please try again.",
    retry: true,
  },
};

export const ProfileDetailScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const responsive = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const goBack = useSafeBack("/(app)/(tabs)/discover");
  const toast = useToast();
  const { userId, sceneView, sceneId, profileMode, conversationId } = useLocalSearchParams<{
    userId: string;
    sceneView?: string;
    sceneId?: string;
    profileMode?: string;
    conversationId?: string;
  }>();
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [currentScene, setCurrentScene] = useState<SceneDto | null>(null);
  const [currentVibe, setCurrentVibe] = useState<VibeDto | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState<ProfileLoadFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const { t } = useLocalization();
  const matchedProfile = profileMode === "MATCH";
  const heroHeight = responsive.compact ? 264 : responsive.wide ? 380 : 320;
  const heroWidth = Math.min(
    width - responsive.screenPadding * 2,
    responsive.wide ? 520 : layout.contentMaxWidth,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailure(null);
    setProfile(null);
    setCurrentScene(null);
    setCurrentVibe(null);
    setPhotoIndex(0);
    if (!userId) {
      setLoadFailure("unavailable");
      setLoading(false);
      return;
    }
    try {
      const [found, sceneResponse, vibeResponse] = await Promise.all([
        profilesApi.publicById(userId),
        scenesApi.forUser(userId).catch(() => ({ scene: null })),
        vibesApi.forUser(userId).catch(() => ({ vibe: null })),
      ]);
      setProfile(found);
      setCurrentScene(sceneView === "1" && sceneId && sceneResponse.scene?.id !== sceneId ? null : sceneResponse.scene);
      setCurrentVibe(vibeResponse.vibe);
      void analyticsApi
        .ingest([
          {
            name: "profile_opened",
            contextId: found.userId,
            properties: { compatibilityScore: found.compatibility.score },
          },
        ])
        .catch(() => undefined);
    } catch (error) {
      setLoadFailure(classifyProfileLoadFailure(error));
    } finally {
      setLoading(false);
    }
  }, [sceneId, sceneView, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const lifestyle = useMemo(() => {
    if (!profile) return [];
    return [
      profile.lifestyle.exercise ? `Exercise · ${humanize(profile.lifestyle.exercise)}` : null,
      profile.lifestyle.diet ? `Diet · ${humanize(profile.lifestyle.diet)}` : null,
      profile.lifestyle.socialEnergy
        ? `Social energy · ${humanize(profile.lifestyle.socialEnergy)}`
        : null,
      profile.preferredRelationshipPace
        ? `Pace · ${humanize(profile.preferredRelationshipPace)}`
        : null,
    ].filter((item): item is string => Boolean(item));
  }, [profile]);

  const interested = async (introNote?: string): Promise<boolean> => {
    if (!profile || submitting) return false;
    const note = introNote?.trim();
    const fromScene = sceneView === "1";
    if (fromScene && !currentScene) return false;
    setSubmitting(true);
    try {
      const response = await likesApi.like(
        {
          targetUserId: profile.userId,
          ...(fromScene && currentScene ? { sceneId: currentScene.id } : {}),
          ...(note ? { introNote: note } : {}),
        },
        `${fromScene ? "scene" : "intentional"}-like-${profile.userId}-${Date.now()}`,
      );
      void analyticsApi
        .ingest([
          {
            name: "interest_sent",
            contextId: profile.userId,
            properties: {
              source: fromScene ? "scene_view" : "profile_detail",
              hadPrivateNote: Boolean(note),
              ...(fromScene && currentScene ? { sceneId: currentScene.id } : {}),
            },
          },
          ...(response.outcome === "MATCH_CREATED" && response.match
            ? [{ name: "match_created", contextId: response.match.id }]
            : []),
        ])
        .catch(() => undefined);
      if (response.outcome === "MATCH_CREATED" && response.match) {
        router.replace({
          pathname: "/(modal)/match-created",
          params: { matchId: response.match.id },
        });
      } else {
        toast.show(
          fromScene
            ? note
              ? t("scene.reply.sent")
              : t("scene.like.sent")
            : "Interest sent privately.",
          "success",
        );
        if (!fromScene) goBack();
      }
      return true;
    } catch {
      toast.show(fromScene ? t("scene.response.error") : "Couldn’t send your interest.", "error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const block = async () => {
    if (!profile) return;
    setBlocking(true);
    try {
      await safetyApi.block({ blockedUserId: profile.userId, reason: "Blocked from profile" });
      setBlockOpen(false);
      toast.show(`${profile.displayName} blocked.`, "success");
      goBack();
    } catch {
      toast.show("Couldn’t block this person.", "error");
    } finally {
      setBlocking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
        <Header showBack onLeftPress={goBack} title="Profile" />
        <View style={[styles.loading, { paddingHorizontal: responsive.screenPadding }]}>
          <Skeleton height={heroHeight} borderRadius={radius.xl} />
          <Skeleton height={150} borderRadius={radius.card} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile || (sceneView === "1" && !currentScene)) {
    const failure = profile
      ? { title: "Scene unavailable", body: "Refresh Scenes to see what’s available now.", retry: false }
      : PROFILE_FAILURE_COPY[loadFailure ?? "unavailable"];
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
        <Header showBack onLeftPress={goBack} title="Profile" />
        <View style={styles.unavailable}>
          <Icon
            name={loadFailure === "offline" ? "warning" : "user"}
            size={36}
            color={palette.textSubdued}
          />
          <Text variant="title">{failure.title}</Text>
          <Text variant="body" color="textSubdued">
            {failure.body}
          </Text>
          <View style={styles.errorActions}>
            {failure.retry ? <Button label="Try again" onPress={() => void load()} /> : null}
            <Button label="Go back" variant="secondary" onPress={goBack} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const photos = profile.photos;
  const currentPhoto = photos[photoIndex] ?? photos[0];
  const age = profile.age === null ? "" : `, ${profile.age}`;

  if (sceneView === "1" && currentScene) {
    return (
      <SceneViewer
        identity={{
          displayName: profile.displayName,
          age: profile.age,
          photoUrl:
            (profile.photos.find((photo) => photo.isPrimary) ?? profile.photos[0])?.url ?? null,
        }}
        scene={currentScene}
        mode="candidate"
        busy={submitting}
        onClose={goBack}
        onLike={() => interested()}
        onReply={(message) => interested(message)}
      />
    );
  }

  const openReport = () => {
    setProfileActionsOpen(false);
    router.push({
      pathname: "/(app)/report",
      params: {
        targetType: "USER",
        targetId: profile.userId,
        reportedUserId: profile.userId,
      },
    });
  };

  const sceneIntent = currentScene
    ? currentScene.intent === "DATING"
      ? t("scene.intent.dating")
      : currentScene.intent === "FRIENDSHIP"
        ? t("scene.intent.friendship")
        : t("scene.intent.casualHang")
    : null;
  const sceneAvailability = currentScene?.availableUntil
    ? new Date(currentScene.availableUntil).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : t("scene.availability.flexible");
  const lifestyleDetails = [
    ...lifestyle,
    ...profile.languages,
    ...(profile.occupation ? [profile.occupation] : []),
  ];
  const featuredPrompt = profile.profilePrompts.find((prompt) => prompt.answer.trim().length > 0);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileShell, { paddingHorizontal: responsive.screenPadding }]}>
          <View style={[styles.hero, { width: heroWidth, height: heroHeight }]}>
            {isProtectedPhotoSource(currentPhoto?.url) ? (
              <View style={[styles.heroImage, styles.photoFallback]}>
                <Icon name="lock" size={32} color={palette.brand} />
                <Text variant="bodyStrong">Photos stay private</Text>
                <Text variant="caption" color="textSubdued">
                  Reveal together in your chat
                </Text>
              </View>
            ) : currentPhoto ? (
              <Image
                source={currentPhoto.url}
                contentFit="cover"
                transition={180}
                style={styles.heroImage}
              />
            ) : (
              <View style={[styles.heroImage, styles.photoFallback]}>
                <Icon name="user" size={44} color={palette.textMuted} />
              </View>
            )}
            {photos.length > 1 && !isProtectedPhotoSource(currentPhoto?.url) ? (
              <View style={styles.photoNav}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  onPress={() =>
                    setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)
                  }
                  style={styles.photoTap}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  onPress={() => setPhotoIndex((index) => (index + 1) % photos.length)}
                  style={styles.photoTap}
                />
              </View>
            ) : null}
            <View style={styles.heroActions}>
              <IconButton size={40} tone="surface" accessibilityLabel="Go back" onPress={goBack}>
                <Icon name="arrowLeft" size={20} color={palette.textPrimary} />
              </IconButton>
              <IconButton
                size={40}
                tone="surface"
                accessibilityLabel="Profile options"
                onPress={() => setProfileActionsOpen(true)}
              >
                <Icon name="more" size={20} color={palette.textPrimary} />
              </IconButton>
            </View>
            {photos.length > 1 && !isProtectedPhotoSource(currentPhoto?.url) ? (
              <View style={styles.photoCount} pointerEvents="none">
                <Text variant="captionStrong" color="alwaysWhite">
                  {photoIndex + 1}/{photos.length}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.profileContent}>
            <View style={styles.identity}>
              <View style={styles.nameRow}>
                <Text variant="title" numberOfLines={1} style={styles.name}>
                  {profile.displayName}
                  {age}
                </Text>
                <VerificationBadge status={profile.verificationStatus} compact />
              </View>
              <View style={styles.metaRow}>
                <Icon name="location" size={14} color={palette.textSubdued} />
                <Text
                  variant="caption"
                  color="textSubdued"
                  numberOfLines={1}
                  style={styles.metaText}
                >
                  {[profile.location.city, formatDistance(profile.location.distanceKmRounded)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <View style={styles.wrapRow}>
                {profile.intents.map((intent) => (
                  <IntentBadge key={intent} intent={intent} size="sm" />
                ))}
              </View>
            </View>

            {currentVibe?.status === "READY" && currentVibe.playbackUrl ? (
              <View style={styles.vibeSection}>
                <Text variant="heading">My vibe</Text>
                <View style={styles.vibePreview}>
                  <VibeProfilePreview vibe={currentVibe} displayName={profile.displayName} />
                </View>
              </View>
            ) : null}

            {profile.bio || featuredPrompt ? (
              <View style={styles.detailSection}>
                <Text variant="heading">About me</Text>
                <View>
                  {profile.bio ? (
                    <View>
                      <Text variant="body" color="textSecondary">
                        {profile.bio}
                      </Text>
                    </View>
                  ) : null}
                  {featuredPrompt ? (
                    <View style={[styles.featuredPrompt, profile.bio ? styles.dividedRow : null]}>
                      <Text variant="micro" color="textBrand" weight="600">
                        {profilePromptLabel(featuredPrompt.promptId)}
                      </Text>
                      <Text variant="bodyStrong">{featuredPrompt.answer}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {profile.interests.length > 0 ? (
              <View style={styles.detailSection}>
                <Text variant="heading">Interests</Text>
                <View style={styles.wrapRow}>
                  {profile.interests.map((interest) => (
                    <Chip
                      key={interest.id}
                      label={interest.displayName}
                      size="sm"
                      tone={
                        profile.compatibility.sharedInterests.includes(interest.displayName)
                          ? "brand"
                          : "default"
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {currentScene ? (
              <NavigationListSection label="SCENE">
                <View
                  accessible
                  accessibilityLabel={`${profile.displayName}'s Scene, ${currentScene.activity}`}
                  style={styles.sceneRow}
                >
                  {currentScene.photo ? (
                    <Image
                      source={currentScene.photo.url}
                      contentFit="cover"
                      style={styles.scenePhoto}
                      accessibilityLabel={`${profile.displayName}'s Scene photo`}
                    />
                  ) : (
                    <View style={[styles.scenePhoto, styles.photoFallback]}>
                      <Icon name="spark" size={20} color={palette.textBrand} />
                    </View>
                  )}
                  <View style={styles.sceneCopy}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {currentScene.activity}
                    </Text>
                    <Text variant="caption" color="textSubdued" numberOfLines={1}>
                      {sceneIntent} · {sceneAvailability}
                    </Text>
                  </View>
                </View>
              </NavigationListSection>
            ) : null}

            <CompatibilitySummary compatibility={profile.compatibility} compact />

            {lifestyleDetails.length > 0 ? (
              <NavigationListSection label="LIFESTYLE">
                <View style={[styles.contentBlock, styles.wrapRow]}>
                  {profile.occupation ? <Chip label={profile.occupation} size="sm" /> : null}
                  {lifestyle.map((item) => (
                    <Chip key={item} label={item} size="sm" tone="soft" />
                  ))}
                  {profile.languages.map((language) => (
                    <Chip key={language} label={language} size="sm" />
                  ))}
                </View>
              </NavigationListSection>
            ) : null}

            {profile.sensitiveCompatibility ? (
              <NavigationListSection label="VALUES SHARED BY CHOICE">
                <View>
                  {Object.entries(profile.sensitiveCompatibility)
                    .filter(([, value]) => Boolean(value))
                    .map(([key, value], index) => (
                      <View
                        key={key}
                        style={[styles.valueRow, index > 0 ? styles.dividedRow : null]}
                      >
                        <Text variant="caption" color="textSubdued">
                          {humanize(key)}
                        </Text>
                        <Text variant="bodyStrong">{humanize(value) ?? "—"}</Text>
                      </View>
                    ))}
                </View>
              </NavigationListSection>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {matchedProfile ? (
        <ResponsiveBottomAction
          primary={
            <Button
              label={conversationId ? "Message" : "Back to connection"}
              fullWidth
              leftIcon={
                <Icon
                  name={conversationId ? "chat" : "arrowLeft"}
                  size={18}
                  color={palette.textOnBrand}
                />
              }
              onPress={() =>
                conversationId
                  ? router.push({
                      pathname: "/(app)/conversation/[conversationId]",
                      params: { conversationId },
                    })
                  : goBack()
              }
            />
          }
        />
      ) : (
        <ResponsiveBottomAction
          primary={
            <Button
              label="Interested"
              variant="interest"
              fullWidth
              loading={submitting}
              leftIcon={<Icon name="heart" size={18} color={palette.ctaText} />}
              onPress={() => void interested()}
            />
          }
        />
      )}

      <CenterDialog
        visible={profileActionsOpen}
        onClose={() => setProfileActionsOpen(false)}
        accessibilityLabel="Profile options"
      >
        <View style={styles.dialogContent}>
          <Text variant="titleSm">Profile options</Text>
          <NavigationListSection>
            <NavigationListRow first icon="flag" label="Report profile" onPress={openReport} />
            <NavigationListRow
              icon="block"
              label="Block profile"
              danger
              onPress={() => {
                setProfileActionsOpen(false);
                setBlockOpen(true);
              }}
            />
          </NavigationListSection>
          <Button
            label="Close"
            variant="ghost"
            fullWidth
            onPress={() => setProfileActionsOpen(false)}
          />
        </View>
      </CenterDialog>

      <BlockConfirmModal
        visible={blockOpen}
        displayName={profile.displayName}
        busy={blocking}
        onCancel={() => setBlockOpen(false)}
        onConfirm={() => void block()}
      />
    </SafeAreaView>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loading: {
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  unavailable: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  errorActions: {
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  profileShell: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    gap: 0,
  },
  hero: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceSubdued,
  },
  profileContent: {
    marginTop: -radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: palette.background,
  },
  heroImage: {
    position: "absolute",
    inset: 0,
  },
  photoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoNav: {
    position: "absolute",
    inset: 0,
    flexDirection: "row",
  },
  photoTap: {
    flex: 1,
  },
  heroActions: {
    position: "absolute",
    zIndex: 2,
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  photoCount: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.mediaScrimBottom,
  },
  identity: { gap: spacing.sm },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: { flex: 1, minWidth: 0 },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  vibeSection: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.brandSubdued,
  },
  detailSection: { gap: spacing.sm },
  sceneRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scenePhoto: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSubdued,
  },
  sceneCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  vibePreview: { overflow: "hidden", borderRadius: radius.lg },
  featuredPrompt: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  contentBlock: {
    padding: spacing.md,
  },
  valueRow: {
    minHeight: 54,
    gap: spacing.xxs,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dividedRow: {
    borderTopWidth: 1,
    borderTopColor: palette.divider,
  },
  dialogContent: { gap: spacing.md },
}));
