import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { privateStoriesApi } from "../../api/endpoints/privateStories";
import { vibesApi } from "../../api/endpoints/vibes";
import { activityApi } from "../../api/endpoints/activity";
import { ApiError } from "../../api/errors";
import { useBottomNavigationInset } from "../../components/navigation/bottomNavigation";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Skeleton } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { useResponsiveLayout } from "../../theme/responsive";
import { radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import type { MyProfileDto } from "../../types/profile";
import type { WeeklyRecap } from "../../types/activity";
import type { VibeDto } from "../../types/vibe";
import { useActivitySummary } from "../activity/useActivitySummary";

type FollowTab = "followers" | "following" | "requests";

/** Compact overview of the owner's real profile, relationships and activity. */
export const MyProfileScreen: React.FC = () => {
  const router = useRouter();
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();
  const { width } = useWindowDimensions();
  const stackFeatureCards = width < 340 || responsive.accessibilityLayout;
  const compactFeatureCards = width < 400 && !stackFeatureCards;
  const bottomNavigationInset = useBottomNavigationInset();
  const activity = useActivitySummary();
  const [profile, setProfile] = useState<MyProfileDto | null>(null);
  const [privateStoriesEnabled, setPrivateStoriesEnabled] = useState(false);
  const [followSummary, setFollowSummary] = useState<{
    followers: number;
    following: number;
    requests: number;
  } | null>(null);
  const [vibe, setVibe] = useState<VibeDto | null>(null);
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ownProfile, stories, summary, ownVibe] = await Promise.all([
        profilesApi.me(),
        privateStoriesApi.capabilities().catch(() => null),
        privateStoriesApi.followSummary().catch(() => null),
        vibesApi.mine().catch(() => null),
      ]);
      setProfile(ownProfile);
      setPrivateStoriesEnabled(stories?.enabled ?? false);
      setFollowSummary(summary);
      setVibe(ownVibe?.vibe ?? null);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.isAuthInvalid() || cause.status === 403))
        setProfile(null);
      setError(cause instanceof Error ? cause.message : "Couldn’t load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (activity?.enabled) {
        void activityApi
          .recap()
          .then(({ recap: next }) => {
            if (active) setRecap(next);
          })
          .catch(() => {
            if (active) setRecap(null);
          });
      } else {
        setRecap(null);
      }
      return () => {
        active = false;
      };
    }, [activity?.enabled]),
  );

  const openFollowTab = (tab: FollowTab) =>
    router.push({ pathname: "/(app)/private-stories/follows", params: { tab } });
  const openEditor = () => router.push("/(app)/settings/edit-profile");
  const header = (
    <View style={[styles.header, { paddingHorizontal: responsive.screenPadding }]}>
      <Text variant="titleSm" align="center" style={styles.headerTitle}>
        Profile
      </Text>
      <IconButton
        tone="ghost"
        size={48}
        onPress={() => router.push("/(app)/settings")}
        accessibilityLabel="Settings"
        style={styles.settingsButton}
      >
        <Icon name="settings" size={22} />
      </IconButton>
    </View>
  );

  if (loading && !profile) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
          {header}
          <View
            style={[
              styles.loading,
              {
                maxWidth: responsive.contentMaxWidth,
                paddingHorizontal: responsive.screenPadding,
              },
            ]}
          >
            <View style={styles.loadingIdentity}>
              <Skeleton width={104} height={104} borderRadius={52} />
              <View style={styles.loadingCopy}>
                <Skeleton width="52%" height={20} />
                <Skeleton width="38%" height={14} />
              </View>
            </View>
            <Skeleton height={72} borderRadius={radius.xl} />
            <Skeleton height={140} borderRadius={radius.xl} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
          {header}
          <View style={styles.errorState} accessibilityLiveRegion="polite">
            <Text variant="bodyStrong" align="center">
              We couldn’t load your profile.
            </Text>
            <Text variant="caption" color="textSubdued" align="center">
              {error ?? "Check your connection and try again."}
            </Text>
            <Button label="Try again" variant="secondary" onPress={() => void load()} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const primaryPhoto = profile.photos.find((photo) => photo.isPrimary) ?? profile.photos[0];
  const initials =
    profile.displayName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "–";
  const age = (() => {
    if (!profile.dateOfBirth || profile.hideAge) return null;
    const dob = new Date(profile.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let value = now.getFullYear() - dob.getFullYear();
    if (
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
    ) {
      value -= 1;
    }
    return value;
  })();
  const stats: { key: FollowTab; label: string; value: number | null }[] = [
    { key: "followers", label: "Followers", value: followSummary?.followers ?? null },
    { key: "following", label: "Following", value: followSummary?.following ?? null },
    { key: "requests", label: "Requests", value: followSummary?.requests ?? null },
  ];
  const readyVibe = vibe?.status === "READY" ? vibe : null;
  const vibeSeconds =
    readyVibe?.durationMs != null && readyVibe.durationMs <= 5000
      ? `0:${String(Math.ceil(readyVibe.durationMs / 1000)).padStart(2, "0")}`
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        {header}

        <ScrollView
          style={{ marginBottom: Math.max(bottomNavigationInset - spacing.md, 0) }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              maxWidth: responsive.contentMaxWidth,
              paddingHorizontal: responsive.screenPadding,
              paddingBottom: spacing.xxl,
            },
          ]}
        >
          {error ? (
            <View style={styles.refreshError} accessibilityLiveRegion="polite">
              <Text variant="caption" color="textSubdued">
                Couldn’t refresh your profile. Showing the last loaded details.
              </Text>
              <Button label="Try again" size="sm" variant="secondary" onPress={() => void load()} />
            </View>
          ) : null}
          <View style={styles.identity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile photos"
              onPress={() => router.push("/(app)/settings/profile/photos")}
              style={styles.avatarPressable}
            >
              <View style={[styles.avatar, { backgroundColor: palette.brandSubdued }]}>
                {primaryPhoto?.url ? (
                  <Image source={{ uri: primaryPhoto.url }} style={styles.avatarImage} />
                ) : (
                  <Text variant="titleSm" color="textBrand">
                    {initials}
                  </Text>
                )}
              </View>
              <View style={[styles.avatarEdit, { backgroundColor: palette.brand, borderColor: palette.background }]}>
                <Icon name="edit" size={15} color={palette.alwaysWhite} />
              </View>
            </Pressable>
            <View style={styles.identityCopy}>
              <Text variant="titleSm" numberOfLines={1}>
                {profile.displayName || "Your profile"}
                {age != null ? `, ${age}` : ""}
              </Text>
              <View style={styles.locationRow}>
                <Icon name="location" size={14} color={palette.textSubdued} />
                <Text variant="caption" color="textSubdued" numberOfLines={1}>
                  {[profile.city, profile.region].filter(Boolean).join(", ") || "Add your city"}
                </Text>
              </View>
              {profile.headline ? (
                <Text variant="caption" color="textSubdued" numberOfLines={2}>
                  {profile.headline}
                </Text>
              ) : null}
              {profile.interests.length ? (
                <View style={styles.identityChips}>
                  {profile.interests.slice(0, 2).map((interest) => (
                    <View
                      key={interest.id}
                      style={[styles.chip, { backgroundColor: palette.surfaceTint }]}
                    >
                      <Text variant="micro" numberOfLines={1}>
                        {interest.displayName}
                      </Text>
                    </View>
                  ))}
                  {profile.interests.length > 2 ? (
                    <Text variant="micro" color="textSubdued">
                      +{profile.interests.length - 2}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.statsCard,
              { backgroundColor: palette.surface, borderColor: palette.borderSubdued },
            ]}
          >
            {stats.map((stat, index) => (
              <React.Fragment key={stat.key}>
                {index > 0 ? (
                  <View style={[styles.statDivider, { backgroundColor: palette.divider }]} />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${stat.value ?? "Unavailable"} ${stat.label}. Open ${stat.label}.`}
                  onPress={() => openFollowTab(stat.key)}
                  style={({ pressed }) => [
                    styles.stat,
                    { backgroundColor: pressed ? palette.surfaceTint : palette.transparent },
                  ]}
                >
                  <View style={styles.statValueRow}>
                    <Text variant="subheading">{stat.value ?? "—"}</Text>
                    {stat.key === "requests" && (stat.value ?? 0) > 0 ? (
                      <View style={[styles.pendingDot, { backgroundColor: palette.brand }]} />
                    ) : null}
                  </View>
                  <Text variant="caption" color="textSubdued" numberOfLines={1}>
                    {stat.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Profile ${profile.completion.isComplete ? "complete" : "needs attention"}. Edit profile.`}
            onPress={openEditor}
            style={({ pressed }) => [
              styles.completionCard,
              { backgroundColor: pressed ? palette.surfaceTint : palette.transparent },
            ]}
          >
            <Text variant="captionStrong">Profile setup</Text>
            <Text variant="caption" color="textSubdued" style={styles.completionStatus}>
              {profile.completion.isComplete ? "Complete" : "Needs attention"}
            </Text>
            <Icon name="chevronRight" size={18} color={palette.textSubdued} />
          </Pressable>

          <View style={[styles.featureRow, stackFeatureCards && styles.featureRowStacked]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="My Vibe. Open your five-second introduction."
              onPress={() => router.push("/(app)/vibe")}
              style={({ pressed }) => [
                styles.featureCard,
                compactFeatureCards && styles.featureCardCompact,
                stackFeatureCards && styles.featureCardStacked,
                {
                  backgroundColor: pressed ? palette.surfaceTint : palette.surface,
                  borderColor: palette.borderSubdued,
                },
              ]}
            >
              <View style={[styles.featureMedia, compactFeatureCards && styles.featureMediaCompact, { backgroundColor: palette.brandSubdued }]}>
                {readyVibe && (primaryPhoto?.url || readyVibe.thumbnailUrl) ? (
                  <Image source={{ uri: primaryPhoto?.url || readyVibe.thumbnailUrl || undefined }} style={styles.featureImage} />
                ) : (
                  <Icon name="video" size={26} color={palette.brandSecondary} />
                )}
                {readyVibe ? (
                  <View style={[styles.vibeDuration, { backgroundColor: palette.overlayDark }]}>
                    <Icon name="play" size={10} color={palette.alwaysWhite} />
                    {vibeSeconds ? (
                      <Text variant="micro" color="alwaysWhite">
                        {vibeSeconds}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.featureCopy}>
                <Text variant={compactFeatureCards ? "captionStrong" : "bodyStrong"} numberOfLines={1}>
                  My Vibe
                </Text>
                <Text variant={compactFeatureCards ? "micro" : "caption"} color="textSubdued" numberOfLines={2}>
                  {compactFeatureCards ? (readyVibe ? "5-sec intro" : "Add intro") : readyVibe ? "Your quick hello" : "Add a quick hello"}
                </Text>
              </View>
              {!compactFeatureCards ? <Icon name="chevronRight" size={16} color={palette.textSubdued} /> : null}
            </Pressable>
            {privateStoriesEnabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Private Stories. Share with your approved audience."
                onPress={() => router.push("/(app)/private-stories")}
                style={({ pressed }) => [
                  styles.featureCard,
                  compactFeatureCards && styles.featureCardCompact,
                  stackFeatureCards && styles.featureCardStacked,
                  {
                    backgroundColor: pressed ? palette.surfaceTint : palette.surface,
                    borderColor: palette.borderSubdued,
                  },
                ]}
              >
                <View style={[styles.featureIcon, compactFeatureCards && styles.featureIconCompact, { backgroundColor: palette.brandSubdued }]}>
                  <Icon name="lock" size={23} color={palette.brandSecondary} />
                </View>
                <View style={styles.featureCopy}>
                  <Text variant={compactFeatureCards ? "captionStrong" : "bodyStrong"} numberOfLines={2}>
                    Private Stories
                  </Text>
                  <Text variant={compactFeatureCards ? "micro" : "caption"} color="textSubdued" numberOfLines={2}>
                    {compactFeatureCards ? "Approved circle" : "Share with approved people"}
                  </Text>
                </View>
                {!compactFeatureCards ? <Icon name="chevronRight" size={16} color={palette.textSubdued} /> : null}
              </Pressable>
            ) : null}
          </View>

          {activity ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Weekly recap"
              onPress={() => router.push("/(app)/weekly-recap")}
              style={({ pressed }) => [
                styles.recapCard,
                {
                  backgroundColor: pressed ? palette.surfaceTint : palette.surface,
                  borderColor: palette.borderSubdued,
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.recapHeading}>
                  <Icon name="spark" size={20} color={palette.brand} />
                  <Text variant="bodyStrong">Weekly recap</Text>
                </View>
                <View style={styles.row}>
                  <Text variant="caption" color="textSubdued">
                    This week
                  </Text>
                  <Icon name="chevronRight" size={18} color={palette.textSubdued} />
                </View>
              </View>
              {recap?.historyAvailable ? (
                <View style={styles.recapStats}>
                  {[
                    [recap.scenesPublished, "Scenes"],
                    [recap.plansAccepted, "Plans"],
                    [recap.activityDays, "Active days"],
                  ].map(([value, label]) => (
                    <View key={label} style={styles.recapStat}>
                      <Text variant="subheading">{value}</Text>
                      <Text variant="micro" color="textSubdued" align="center">
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text variant="caption" color="textSubdued">
                  See your recent activity and progress.
                </Text>
              )}
            </Pressable>
          ) : null}

          <View style={styles.aboutSection}>
            <View style={styles.aboutHeader}>
              <Text variant="bodyStrong">About me</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit About me"
                onPress={openEditor}
                style={styles.textAction}
              >
                <Text variant="captionStrong" color="textBrand">
                  Edit
                </Text>
              </Pressable>
            </View>
            <Text variant="body" color="textSubdued" style={styles.aboutBio}>
              {profile.bio?.trim() || "Add a few words about yourself."}
            </Text>
            {profile.interests.length ? (
              <View style={[styles.aboutInterests, { borderTopColor: palette.divider }]}>
                <Text variant="micro" color="textSubdued" style={styles.interestsLabel}>
                  INTERESTS
                </Text>
                <Text variant="caption" color="textPrimary" style={styles.interestsText}>
                  {profile.interests.map((interest) => interest.displayName).join("  ·  ")}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.sectionCard,
              { backgroundColor: palette.surface, borderColor: palette.borderSubdued },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="bodyStrong">Photos</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all photos"
                onPress={() => router.push("/(app)/settings/profile/photos")}
                style={styles.textAction}
              >
                <Text variant="caption" color="textSubdued">
                  See all
                </Text>
                <Icon name="chevronRight" size={16} color={palette.textSubdued} />
              </Pressable>
            </View>
            {profile.photos.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photos}
              >
                {profile.photos.map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.url }}
                    style={[styles.photo, { backgroundColor: palette.surfaceTint }]}
                  />
                ))}
              </ScrollView>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/(app)/settings/profile/photos")}
                style={[styles.emptyPhotos, { backgroundColor: palette.surfaceTint }]}
              >
                <Icon name="image" size={20} color={palette.textSubdued} />
                <Text variant="caption" color="textSubdued">
                  Add photos to your profile
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.xs,
  },
  headerTitle: { flex: 1 },
  settingsButton: { position: "absolute", right: spacing.md },
  content: { width: "100%", alignSelf: "center", gap: spacing.sm },
  refreshError: { alignItems: "flex-start", gap: spacing.sm },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPressable: { width: 84, height: 84 },
  avatarEdit: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarImage: { width: 84, height: 84 },
  identityCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  identityChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginTop: spacing.xxs,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    maxWidth: "100%",
  },
  statsCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    flexDirection: "row",
    minHeight: 60,
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 60,
  },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "center", height: 30 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  pendingDot: { width: 7, height: 7, borderRadius: 4 },
  completionCard: {
    borderRadius: radius.sm,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  completionStatus: { flex: 1, textAlign: "right" },
  featureRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  featureRowStacked: { flexDirection: "column" },
  featureCard: {
    flexGrow: 1,
    flexBasis: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    minHeight: 70,
  },
  featureCardCompact: { gap: spacing.xs, padding: spacing.xs, minHeight: 66 },
  featureCardStacked: { flexGrow: 0, flexBasis: "auto", width: "100%" },
  featureMedia: {
    width: 46,
    height: 50,
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  featureMediaCompact: { width: 38, height: 44 },
  featureImage: { width: "100%", height: "100%" },
  vibeDuration: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconCompact: { width: 38, height: 38 },
  featureCopy: { flex: 1, minWidth: 0, gap: 2 },
  recapCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xxs },
  recapHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  recapStats: { flexDirection: "row", justifyContent: "space-around" },
  recapStat: { flex: 1, alignItems: "center", gap: 2 },
  sectionCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xxs },
  aboutSection: { paddingHorizontal: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.sm },
  aboutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aboutBio: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  aboutInterests: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.sm },
  interestsLabel: { marginBottom: spacing.xs },
  interestsText: { lineHeight: 19 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  textAction: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  photos: { gap: spacing.sm },
  photo: { width: 76, height: 88, borderRadius: radius.md },
  emptyPhotos: {
    minHeight: 66,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loading: { width: "100%", alignSelf: "center", gap: spacing.lg },
  loadingIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  loadingCopy: { flex: 1, gap: spacing.sm },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
});
