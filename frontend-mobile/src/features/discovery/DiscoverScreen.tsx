import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, View, type ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { discoveryApi } from "../../api/endpoints/discovery";
import { analyticsApi } from "../../api/endpoints/analytics";
import { likesApi } from "../../api/endpoints/likes";
import { profilesApi } from "../../api/endpoints/profiles";
import { ApiError } from "../../api/errors";
import { InterestConfirmationSheet } from "../../components/dating/InterestConfirmationSheet";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { Skeleton } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { YarivaWordmark } from "../../components/ui/YarivaBrand";
import { useBottomNavigationInset } from "../../components/navigation/bottomNavigation";
import { useToast } from "../../components/ui/Toast";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import type {
  DiscoveryPreferenceDto,
  PrivatePhotoDto,
  PublicProfileDto,
} from "../../types/profile";
import { DiscoveryFilterSheet } from "./DiscoveryFilterSheet";
import { ScenesPanel } from "../scenes/ScenesPanel";
import { WingmanEntry } from "../wingman/WingmanEntry";
import { BlindEntry } from "../blind/BlindEntry";
import { ProfileFeed } from "./ProfileFeed";

export const DiscoverScreen: React.FC = () => {
  const router = useRouter();
  const toast = useToast();
  const { palette } = useTheme();
  const styles = useStyles();
  const bottomNavigationInset = useBottomNavigationInset();
  const loaded = useRef(false);
  const [items, setItems] = useState<PublicProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restricted, setRestricted] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [interestProfile, setInterestProfile] = useState<PublicProfileDto | null>(null);
  const [introNote, setIntroNote] = useState("");
  const [sendingInterest, setSendingInterest] = useState(false);
  const [preference, setPreference] = useState<DiscoveryPreferenceDto | null>(null);
  const [scenePhotos, setScenePhotos] = useState<PrivatePhotoDto[]>([]);
  const [sceneOwnerName, setSceneOwnerName] = useState("My Scene");
  const [locationLabel, setLocationLabel] = useState("Your area");
  const viewedProfileIds = useRef(new Set<string>());
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<PublicProfileDto>> }) => {
      const newlyViewed = viewableItems
        .map((token) => token.item)
        .filter((profile) => {
          if (!profile || viewedProfileIds.current.has(profile.userId)) return false;
          viewedProfileIds.current.add(profile.userId);
          return true;
        });
      if (newlyViewed.length > 0) {
        void analyticsApi
          .ingest(
            newlyViewed.map((profile) => ({
              name: "curated_profile_viewed",
              contextId: profile.userId,
              properties: { compatibilityScore: profile.compatibility.score },
            })),
          )
          .catch(() => undefined);
      }
    },
  ).current;

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      try {
        mode === "initial" ? setLoading(true) : setRefreshing(true);
        const [page, me] = await Promise.all([discoveryApi.feed({ limit: 8 }), profilesApi.me()]);
        setItems(page.items.slice(0, page.dailyLimit));
        setPreference(me.discoveryPreference);
        setScenePhotos(me.photos.filter((photo) => photo.moderationStatus === "APPROVED"));
        setSceneOwnerName(me.displayName?.trim() || "My Scene");
        setLocationLabel(me.city?.trim() || "Your area");
        loaded.current = true;
        setRestricted(null);
        setLoadError(null);
      } catch (error) {
        if (error instanceof ApiError && error.code === "DISCOVERY_PROFILE_INCOMPLETE") {
          setRestricted("Complete your profile before meeting your curated matches.");
        } else if (error instanceof ApiError && error.code === "DISCOVERY_ACCOUNT_RESTRICTED") {
          setRestricted("Discovery is paused. You can resume it from Privacy settings.");
        } else {
          setLoadError("Check your connection and try loading today’s curated profiles again.");
          toast.show("Couldn’t load today’s people.", "error");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  useFocusEffect(
    useCallback(() => {
      void load(loaded.current ? "refresh" : "initial");
    }, [load]),
  );

  const pass = useCallback(
    async (profile: PublicProfileDto) => {
      const originalIndex = Math.max(
        0,
        items.findIndex((item) => item.userId === profile.userId),
      );
      const restoreProfile = () => {
        setItems((current) => {
          if (current.some((item) => item.userId === profile.userId)) return current;
          const next = [...current];
          next.splice(Math.min(originalIndex, next.length), 0, profile);
          return next;
        });
      };
      setItems((current) => current.filter((item) => item.userId !== profile.userId));
      try {
        await likesApi.pass({ targetUserId: profile.userId });
        void analyticsApi
          .ingest([
            {
              name: "profile_passed",
              contextId: profile.userId,
              properties: { source: "discover_feed" },
            },
          ])
          .catch(() => undefined);
        toast.show(`${profile.displayName} hidden for now.`, "info", {
          label: "Undo",
          onPress: async () => {
            try {
              await likesApi.unpass(profile.userId);
              restoreProfile();
              toast.show(`${profile.displayName} is back in your feed.`, "success");
              void analyticsApi
                .ingest([{ name: "profile_pass_undone", contextId: profile.userId }])
                .catch(() => undefined);
            } catch {
              toast.show("Couldn’t undo that choice.", "error");
            }
          },
        });
      } catch {
        restoreProfile();
        toast.show("That choice could not be saved.", "error");
      }
    },
    [items, toast],
  );

  const openInterest = useCallback((profile: PublicProfileDto) => {
    setInterestProfile(profile);
    setIntroNote("");
    void analyticsApi
      .ingest([
        {
          name: "quick_interest_opened",
          contextId: profile.userId,
          properties: { source: "discover_feed" },
        },
      ])
      .catch(() => undefined);
  }, []);

  const closeInterest = useCallback(() => {
    if (sendingInterest) return;
    setInterestProfile(null);
    setIntroNote("");
  }, [sendingInterest]);

  const confirmInterest = useCallback(async () => {
    if (!interestProfile || sendingInterest) return;
    const profile = interestProfile;
    const note = introNote.trim();
    setSendingInterest(true);
    try {
      const response = await likesApi.like(
        {
          targetUserId: profile.userId,
          ...(note ? { introNote: note } : {}),
        },
        `discover-interest-${profile.userId}-${Date.now()}`,
      );
      setItems((current) => current.filter((item) => item.userId !== profile.userId));
      setInterestProfile(null);
      setIntroNote("");
      void analyticsApi
        .ingest([
          {
            name: "interest_sent",
            contextId: profile.userId,
            properties: { source: "discover_feed", hadPrivateNote: Boolean(note) },
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
          note ? "Interest and private note sent." : "Interest sent privately.",
          "success",
        );
      }
    } catch {
      toast.show("Couldn’t send your interest.", "error");
    } finally {
      setSendingInterest(false);
    }
  }, [interestProfile, introNote, router, sendingInterest, toast]);

  const openProfile = useCallback(
    (profile: PublicProfileDto) => {
      router.push({
        pathname: "/(app)/profile/[userId]",
        params: { userId: profile.userId },
      });
    },
    [router],
  );

  const discoverHeader = (
    <>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View
            accessible
            accessibilityLabel={`Dating location ${locationLabel}`}
            style={styles.locationLabel}
          >
            <Icon name="location" size={16} color={palette.textSecondary} />
            <Text
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              style={styles.locationText}
            >
              {locationLabel}
            </Text>
          </View>
          <View pointerEvents="none" style={styles.centeredBrand}>
            <YarivaWordmark size={30} accessibilityLabel="Yariva" />
          </View>
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Discovery preferences"
            style={({ pressed }) => [styles.filterButton, pressed ? styles.pressed : null]}
          >
            <Icon name="filter" size={19} color={palette.textPrimary} />
          </Pressable>
        </View>
      </View>
      <ScenesPanel photos={scenePhotos} ownerName={sceneOwnerName} />
      <View style={styles.modesRow}>
        <WingmanEntry compact />
        <BlindEntry compact />
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
        {loading || restricted || loadError ? discoverHeader : null}
        {loading ? (
          <View style={styles.loading}>
            <Skeleton style={{ flex: 1 }} borderRadius={radius.card} />
          </View>
        ) : restricted ? (
          <View style={styles.stateContent}>
            <EmptyState
              title="Discovery is paused"
              body={restricted}
              actionLabel="Open profile"
              onAction={() => router.push("/(app)/(tabs)/profile")}
            />
          </View>
        ) : loadError ? (
          <View style={styles.stateContent}>
            <EmptyState
              title="Today’s people didn’t load"
              body={loadError}
              actionLabel="Try again"
              onAction={() => void load("initial")}
            />
          </View>
        ) : (
          <View style={{ flex: 1, marginBottom: bottomNavigationInset }}>
            <ProfileFeed
              profiles={items}
              header={discoverHeader}
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              onViewed={onViewableItemsChanged}
              onOpen={openProfile}
              onInterested={openInterest}
              onNotForMe={pass}
              selectedUserId={interestProfile?.userId}
              empty={
                <View style={styles.emptyCard}>
                  <Text variant="titleSm" align="center">
                    That’s everyone we selected for today.
                  </Text>
                  <Text variant="body" color="textSubdued" align="center">
                    Your next set arrives tomorrow.
                  </Text>
                  <Button
                    label="Review preferences"
                    variant="secondary"
                    onPress={() => setFilterOpen(true)}
                  />
                </View>
              }
            />
          </View>
        )}

        {preference ? (
          <DiscoveryFilterSheet
            visible={filterOpen}
            initialPreference={preference}
            onClose={() => setFilterOpen(false)}
            onSaved={() => void load("refresh")}
          />
        ) : null}

        <InterestConfirmationSheet
          visible={interestProfile !== null}
          profile={interestProfile}
          note={introNote}
          busy={sendingInterest}
          onNoteChange={setIntroNote}
          onClose={closeInterest}
          onConfirm={() => void confirmInterest()}
        />
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: controlSize.minimumTouchTarget,
  },
  centeredBrand: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  filterButton: {
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  locationLabel: {
    minHeight: controlSize.minimumTouchTarget,
    maxWidth: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  locationText: { flexShrink: 1 },
  pressed: {
    opacity: 0.72,
  },
  loading: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  stateContent: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  modesRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  emptyCard: {
    gap: spacing.lg,
    padding: spacing.xxl,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
}));
