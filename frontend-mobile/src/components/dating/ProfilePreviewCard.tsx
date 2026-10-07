import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { PublicProfileDto } from "../../types/profile";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { formatDistance } from "../../utils/format";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";
import { VerificationBadge } from "./VerificationBadge";
import { discoveryPhotoHeight } from "./discoveryLayout";
import { usePrivateFollow } from "../../features/privateStories/usePrivateFollow";

type QuickAction = {
  key: "interest" | "pass";
  label: string;
  icon: "heartFill" | "x";
  selected?: boolean;
  onPress: () => void;
};

/** A full-page photo with one compact identity overlay and two clear decisions. */
export const ProfilePreviewCard: React.FC<{
  profile: PublicProfileDto;
  onOpen: (profile: PublicProfileDto) => void;
  onInterested: (profile: PublicProfileDto) => void;
  onNotForMe: (profile: PublicProfileDto) => void;
  interestSelected?: boolean;
  position?: number;
  total?: number;
  availableHeight?: number;
}> = React.memo(
  ({
    profile,
    onOpen,
    onInterested,
    onNotForMe,
    interestSelected = false,
    position,
    total,
    availableHeight,
  }) => {
    const { palette } = useTheme();
    const styles = useStyles();
    const privateFollow = usePrivateFollow(profile.userId);
    const { width, fontScale } = useWindowDimensions();
    const photos = useMemo(
      () =>
        [...profile.photos].sort(
          (left, right) =>
            Number(right.isPrimary) - Number(left.isPrimary) || left.position - right.position,
        ),
      [profile.photos],
    );
    const [photoIndex, setPhotoIndex] = useState(0);
    const currentPhotoIndex = Math.min(photoIndex, Math.max(photos.length - 1, 0));
    const photo = photos[currentPhotoIndex];
    const age = profile.age === null ? "" : `, ${profile.age}`;
    const photoHeight = discoveryPhotoHeight(width, availableHeight);
    const roomy = photoHeight >= 440 * fontScale;
    const mediaHeight = Math.max(photoHeight - 48, 0);

    useEffect(() => {
      setPhotoIndex(0);
    }, [profile.userId, photos.length]);

    const actions: QuickAction[] = [
      {
        key: "pass",
        label: `Skip ${profile.displayName}`,
        icon: "x",
        onPress: () => onNotForMe(profile),
      },
      {
        key: "interest",
        label: `Like ${profile.displayName}`,
        icon: "heartFill",
        selected: interestSelected,
        onPress: () => onInterested(profile),
      },
    ];

    return (
      <View style={[styles.card, { height: photoHeight }]}>
        <View style={[styles.media, { height: mediaHeight }]}>
          <MaskedView
            style={styles.mediaMask}
            maskElement={
              <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Path
                  d="M0 0 H100 V92 Q100 96 96 96 C86 96 81 100 64 100 H36 C19 100 14 96 4 96 Q0 96 0 92 Z"
                  fill="black"
                />
              </Svg>
            }
          >
            {photo ? (
              <Image
                key={photo.id}
                source={photo.url}
                contentFit="cover"
                transition={140}
                style={styles.photo}
              />
            ) : (
              <View style={[styles.photo, styles.placeholder]}>
                <Icon name="user" size={42} color={palette.whiteAlpha70} />
              </View>
            )}
            <LinearGradient
              pointerEvents="none"
              colors={[palette.mediaScrimTop, palette.mediaScrimMid, palette.mediaScrimBottom]}
              locations={[0, 0.42, 1]}
              style={styles.scrim}
            />
            {photos.length > 1 ? (
              <>
                <View
                  pointerEvents="none"
                  accessible
                  accessibilityLabel={`Photo ${currentPhotoIndex + 1} of ${photos.length}`}
                  style={styles.photoCount}
                >
                  <Text variant="captionStrong" color="alwaysWhite">
                    {currentPhotoIndex + 1}/{photos.length}
                  </Text>
                </View>
                <View style={styles.photoNavigation}>
                  <Pressable
                    onPress={() => setPhotoIndex((current) => Math.max(0, current - 1))}
                    disabled={currentPhotoIndex === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Previous photo of ${profile.displayName}`}
                    accessibilityState={{ disabled: currentPhotoIndex === 0 }}
                    style={styles.photoTapZone}
                  />
                  <Pressable
                    onPress={() =>
                      setPhotoIndex((current) => Math.min(photos.length - 1, current + 1))
                    }
                    disabled={currentPhotoIndex === photos.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel={`Next photo of ${profile.displayName}`}
                    accessibilityState={{ disabled: currentPhotoIndex === photos.length - 1 }}
                    style={styles.photoTapZone}
                  />
                </View>
                {currentPhotoIndex < photos.length - 1 ? (
                  <View pointerEvents="none" style={styles.nextPhotoCue}>
                    <Icon name="chevronRight" size={23} color={palette.alwaysWhite} />
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={styles.identity}>
              <View style={styles.identityTopRow}>
                <Pressable
                  onPress={() => onOpen(profile)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${profile.displayName}'s full profile${position && total ? `, ${position} of ${total}` : ""}`}
                  style={({ pressed }) => [
                    styles.identityLink,
                    pressed ? styles.identityPressed : null,
                  ]}
                >
                  <View style={styles.nameRow}>
                    <Text variant="title" color="alwaysWhite" numberOfLines={1} style={styles.name}>
                      {profile.displayName}
                      {age}
                    </Text>
                    <VerificationBadge status={profile.verificationStatus} compact />
                  </View>
                </Pressable>
                <Pressable
                  onPress={privateFollow.change}
                  disabled={privateFollow.busy}
                  hitSlop={{ top: 6, bottom: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    privateFollow.status === "APPROVED"
                      ? `Following ${profile.displayName}. Tap to unfollow`
                      : privateFollow.status === "PENDING"
                        ? `Follow requested for ${profile.displayName}. Tap to cancel`
                        : privateFollow.status === "NONE"
                          ? `Request to follow ${profile.displayName}`
                          : privateFollow.busy
                            ? "Loading follow status"
                            : `Retry loading follow status for ${profile.displayName}`
                  }
                  accessibilityState={{ disabled: privateFollow.busy, busy: privateFollow.busy }}
                  style={({ pressed }) => [
                    styles.followButton,
                    {
                      backgroundColor: privateFollow.status === "APPROVED"
                        ? palette.socialFollowing
                        : privateFollow.status === "PENDING"
                          ? palette.surfaceSubdued
                          : palette.followStart,
                      borderColor: privateFollow.status === "NONE"
                        ? palette.socialAccent
                        : palette.borderStrong,
                    },
                    pressed ? styles.identityPressed : null,
                  ]}
                >
                  {privateFollow.status === "NONE" ? (
                    <Icon name="personAdd" size={17} color={palette.socialAccent} />
                  ) : null}
                  <Text
                    variant="captionStrong"
                    color="textPrimary"
                    numberOfLines={1}
                  >
                    {privateFollow.label}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.locationRow}>
                <Icon name="location" size={14} color={palette.whiteAlpha85} />
                <Text
                  variant="caption"
                  color="alwaysWhite"
                  numberOfLines={1}
                  style={styles.location}
                >
                  {[
                    profile.location.city,
                    formatDistance(profile.location.distanceKmRounded, false),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Pressable
                onPress={() => onOpen(profile)}
                accessibilityRole="button"
                accessibilityLabel={`View ${profile.displayName}'s full profile`}
                style={({ pressed }) => [
                  styles.identityDetails,
                  pressed ? styles.identityPressed : null,
                ]}
              >
                <View style={styles.viewProfileCue}>
                  <Text variant="captionStrong" color="alwaysWhite">
                    View profile
                  </Text>
                  <Icon name="chevronRight" size={14} color={palette.alwaysWhite} />
                </View>
                {profile.headline && roomy ? (
                  <Text
                    variant="body"
                    color="alwaysWhite"
                    numberOfLines={1}
                    style={styles.headline}
                  >
                    {profile.headline}
                  </Text>
                ) : null}
                {roomy && profile.interests.length > 0 ? (
                  <View style={styles.interests}>
                    {profile.interests.slice(0, 2).map((interest) => (
                      <View key={interest.id} style={styles.interestChip}>
                        <Text variant="caption" color="alwaysWhite" numberOfLines={1}>
                          {interest.displayName}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            </View>
          </MaskedView>
        </View>
        <ActionRail actions={actions} />
      </View>
    );
  },
);

ProfilePreviewCard.displayName = "ProfilePreviewCard";

const ActionRail: React.FC<{ actions: QuickAction[] }> = ({ actions }) => {
  const { palette } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.actionRail} accessibilityLabel="Profile decisions">
      {actions.map((action) => (
        <View key={action.key} style={styles.actionColumn}>
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ selected: Boolean(action.selected) }}
            style={({ pressed }) => [
              styles.action,
              action.key === "interest" ? styles.actionInterest : styles.actionNeutral,
              pressed ? styles.actionPressed : null,
            ]}
          >
            {action.key === "interest" ? (
              <LinearGradient
                pointerEvents="none"
                colors={[palette.interestStart, palette.interestEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBlend}
              />
            ) : null}
            <Icon
              name={action.icon}
              filled={Boolean(action.selected)}
              size={action.key === "pass" ? 24 : 23}
              color={action.key === "interest" ? palette.alwaysWhite : palette.textSecondary}
            />
          </Pressable>
          <Text
            variant="captionStrong"
            color={action.key === "interest" ? "textBrand" : "textSecondary"}
          >
            {action.key === "interest" ? "Like" : "Pass"}
          </Text>
        </View>
      ))}
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  card: {
    marginHorizontal: spacing.xl,
    position: "relative",
    overflow: "visible",
  },
  media: {
    overflow: "hidden",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  mediaMask: { flex: 1 },
  photo: { width: "100%", height: "100%", backgroundColor: palette.surfaceInverse },
  placeholder: { alignItems: "center", justifyContent: "center" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  photoCount: {
    position: "absolute",
    zIndex: 3,
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.mediaScrimBottom,
  },
  nextPhotoCue: {
    position: "absolute",
    zIndex: 2,
    right: spacing.sm,
    top: "46%",
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: palette.mediaScrimBottom,
  },
  photoNavigation: {
    position: "absolute",
    zIndex: 1,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
  },
  photoTapZone: { flex: 1 },
  identity: {
    position: "absolute",
    zIndex: 2,
    left: spacing.lg,
    right: spacing.lg,
    bottom: controlSize.minimumTouchTarget + spacing.xxl + spacing.xs,
    gap: spacing.xxs,
  },
  identityPressed: { opacity: 0.82 },
  identityTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identityLink: {
    flex: 1,
    minWidth: 0,
    minHeight: controlSize.minimumTouchTarget,
    justifyContent: "center",
  },
  identityDetails: { minHeight: controlSize.minimumTouchTarget, justifyContent: "center" },
  followButton: {
    minWidth: 80,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    overflow: "hidden",
    borderWidth: 1,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flexShrink: 1 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  location: { color: palette.whiteAlpha85 },
  viewProfileCue: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  headline: { marginTop: spacing.xs },
  interests: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  interestChip: {
    maxWidth: "46%",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.whiteAlpha42,
    backgroundColor: palette.whiteAlpha14,
  },
  actionRail: {
    position: "absolute",
    zIndex: 3,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: spacing.hero,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  actionColumn: { alignItems: "center", gap: spacing.xs },
  action: {
    width: controlSize.minimumTouchTarget + spacing.sm,
    height: controlSize.minimumTouchTarget + spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: "hidden",
  },
  actionInterest: { backgroundColor: palette.interestEnd, borderColor: "transparent" },
  actionNeutral: { backgroundColor: palette.alwaysWhite, borderColor: palette.border },
  actionBlend: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.92 }] },
}));
