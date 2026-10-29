import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "expo-router/react-navigation";
import { scenesApi } from "../../api/endpoints/scenes";
import type { SceneCapabilitiesDto, SceneDto, SceneInput } from "../../types/scenes";
import { SceneComposerSheet } from "../scenes/SceneComposerSheet";
import { SegmentedControl } from "../../components/dating";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  privateStoriesApi,
  type Audience,
  type CommunityLabel,
  type Story,
  communityLabels,
} from "../../api/endpoints/privateStories";
import { uploadToPresignedUrl } from "../../api/upload";
import { Icon, type IconName } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { PrivateStoryViewer } from "./PrivateStoryViewer";
import { PrivateStoryOptionsSheet } from "./PrivateStoryOptionsSheet";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { NavigationListRow } from "../../components/ui/NavigationList";
import { useTheme } from "../../theme/ThemeContext";
import { useResponsiveLayout } from "../../theme/responsive";
import { typography } from "../../theme/typography";
import { controlSize, layout as layoutTokens, radius, spacing } from "../../theme/spacing";
import { useLocalization } from "../../localization/LocalizationContext";
import { formatRelativeTime, formatTimeOfDay } from "../../utils/format";

const SelectedVideoPreview: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

// Private previews remain in memory only; failed/expired signed URLs fall back to content.
function StoryGalleryPreview({ story }: { story: Story }) {
  const { palette } = useTheme();
  const [failed, setFailed] = useState(false);
  const previewUrl = story.moderationStatus === "APPROVED" ? story.previewUrl : null;
  useEffect(() => setFailed(false), [previewUrl]);
  return (
    <View style={[styles.galleryPreview, { backgroundColor: palette.surfaceSubdued }]}>
      <Icon
        name={
          story.mediaMimeType?.startsWith("video/")
            ? "video"
            : story.mediaMimeType
              ? "image"
              : "sparkle"
        }
        size={18}
        color={palette.brand}
      />
      <Text variant="captionStrong" align="center" numberOfLines={3}>
        {story.text ||
          (story.mediaMimeType?.startsWith("video/")
            ? "Video Story"
            : story.mediaMimeType
              ? "Photo Story"
              : "Your Story")}
      </Text>
      {previewUrl && !failed ? (
        <Image
          source={{ uri: previewUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="none"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : null}
    </View>
  );
}

export function PrivateStoriesScreen() {
  const { t, language } = useLocalization();
  const router = useRouter();
  const {
    compose,
    storyId,
    mode: initialMode,
  } = useLocalSearchParams<{ compose?: string; storyId?: string; mode?: string }>();
  const navigation = useNavigation();
  const { palette } = useTheme();
  const layout = useResponsiveLayout();
  const galleryColumns = layout.accessibilityLayout ? 2 : 3;
  const [collection, setCollection] = useState<"mine" | "saved">("mine");
  const [mine, setMine] = useState<Story[]>([]);
  const [feed, setFeed] = useState<Story[]>([]);
  const [people, setPeople] = useState<{ id: string; displayName: string }[]>([]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ uri: string; mimeType: string; sizeBytes: number } | null>(
    null,
  );
  const [rule, setRule] = useState<Audience["audienceRule"]>("ALL_APPROVED");
  const [selected, setSelected] = useState<string[]>([]);
  const [communityFilter, setCommunityFilter] = useState<CommunityLabel | undefined>();
  const [preview, setPreview] = useState<{ eligibleCount: number; lifetimeHours: number } | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [optionsId, setOptionsId] = useState<string | null>(null);
  const optionsStory = mine.find((story) => story.id === optionsId);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (storyId) {
      setOpenId(storyId);
      router.setParams({ storyId: undefined });
    }
  }, [storyId, router]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState<{ uri: string; mimeType: string } | null>(null);
  const [showManage, setShowManage] = useState(compose !== "1");
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false);
  const [audienceSearch, setAudienceSearch] = useState("");
  const audienceRoot = useRef<View>(null);
  const [audienceBottom, setAudienceBottom] = useState(0);
  const [audienceKeyboardTop, setAudienceKeyboardTop] = useState<number | null>(null);
  useEffect(() => {
    if (!audienceSheetOpen || Platform.OS !== "android") return;
    setAudienceKeyboardTop(Keyboard.metrics()?.screenY ?? null);
    const shown = Keyboard.addListener("keyboardDidShow", (event) => {
      setAudienceKeyboardTop(event.endCoordinates.screenY);
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => setAudienceKeyboardTop(null));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [audienceSheetOpen]);
  // Measure the independent modal root, never the sheet that keyboard padding resizes.
  // Android may already resize the native window; compensate only for actual overlap.
  const audienceKeyboardInset =
    Platform.OS === "android" && audienceKeyboardTop !== null
      ? Math.max(0, audienceBottom - audienceKeyboardTop)
      : 0;
  const filteredPeople = useMemo(() => {
    const query = audienceSearch.trim().toLocaleLowerCase();
    return people.filter((person) => person.displayName.toLocaleLowerCase().includes(query));
  }, [people, audienceSearch]);
  const [textMode, setTextMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mineCursor, setMineCursor] = useState<string | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<"mine" | "feed" | null>(null);
  const [pageErrors, setPageErrors] = useState({ mine: false, feed: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"story" | "scene">(initialMode === "scene" ? "scene" : "story");
  const [storyEnabled, setStoryEnabled] = useState(false);
  const [sceneCapabilities, setSceneCapabilities] = useState<SceneCapabilitiesDto | null>(null);
  const [scene, setScene] = useState<SceneDto | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFresh, setSceneFresh] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneSaving, setSceneSaving] = useState(false);
  const [sceneUploading, setSceneUploading] = useState(false);
  const [sceneDirty, setSceneDirty] = useState(false);
  const sceneDraft = useRef({ scene, dirty: sceneDirty });
  sceneDraft.current = { scene, dirty: sceneDirty };
  const [previewError, setPreviewError] = useState(false);
  const [previewRetry, setPreviewRetry] = useState(0);
  const [progress, setProgress] = useState(0);
  const submitting = useRef(false);
  const picking = useRef(false);
  const skipDiscard = useRef(false);
  const editBaseline = useRef("");
  const focused = useRef(false);
  const requestVersion = useRef(0);
  const moreInFlight = useRef(false);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const audience = useMemo<Audience>(
    () => ({
      audienceRule: rule,
      ...(rule === "SELECTED" ? { recipientIds: selected } : {}),
      ...(communityFilter ? { communityFilter } : {}),
    }),
    [rule, selected, communityFilter],
  );
  const draftSignature = JSON.stringify({ text, audience });
  const liveDraft = useRef({ editing, signature: draftSignature });
  liveDraft.current = { editing, signature: draftSignature };
  const storyDirty = !!media || (editing ? draftSignature !== editBaseline.current : !!text.trim());
  const busy = saving || sceneSaving || sceneUploading;
  usePreventRemove(!skipDiscard.current && (storyDirty || sceneDirty || busy), ({ data }) => {
    if (skipDiscard.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (busy) return;
    Alert.alert(t("composer.discardTitle"), t("composer.discardBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("composer.discard"),
        style: "destructive",
        onPress: () => {
          skipDiscard.current = true;
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  const isCurrent = useCallback(
    (version: number) =>
      focused.current && AppState.currentState === "active" && version === requestVersion.current,
    [],
  );
  const clearPrivateData = useCallback(() => {
    requestVersion.current++;
    setSceneFresh(false);
    moreInFlight.current = false;
    setOptionsId(null);
    setMine([]);
    setFeed([]);
    setPeople([]);
    setMineCursor(null);
    setFeedCursor(null);
    setLoadingMore(null);
    setPageErrors({ mine: false, feed: false });
    setLoading(false);
    setError(null);
    setPreview(null);
    setStoryEnabled(false);
  }, []);
  const load = useCallback(async () => {
    if (!focused.current || AppState.currentState !== "active") return;
    clearPrivateData();
    const request = requestVersion.current;
    setLoading(true);
    setError(null);
    const [storyResult, sceneResult] = await Promise.allSettled([
      privateStoriesApi.capabilities(),
      scenesApi.capabilities(),
    ]);
    if (!isCurrent(request)) return;
    const canStory = storyResult.status === "fulfilled" && storyResult.value.enabled;
    setStoryEnabled(canStory);
    if (storyResult.status === "rejected") setError(t("composer.loadError"));
    if (sceneResult.status === "fulfilled") setSceneCapabilities(sceneResult.value);
    if (sceneResult.status === "rejected") setSceneError(t("composer.loadError"));
    await Promise.all([
      (async () => {
        if (!canStory) return;
        try {
          const [own, others, connections] = await Promise.all([
            privateStoriesApi[collection](),
            privateStoriesApi.feed(),
            privateStoriesApi.connections(),
          ]);
          if (!isCurrent(request)) return;
          setMine(own.items);
          setMineCursor(own.nextCursor);
          setFeed(others.items);
          setPeople(connections.people);
          setFeedCursor(others.nextCursor);
        } catch {
          if (isCurrent(request)) setError(t("composer.loadError"));
        }
      })(),
      (async () => {
        if (sceneResult.status !== "fulfilled" || !sceneResult.value.enabled) return;
        try {
          const own = await scenesApi.mine();
          if (!isCurrent(request)) return;
          const latest =
            own.scene?.status === "ACTIVE" && Date.parse(own.scene.expiresAt) > Date.now()
              ? own.scene
              : null;
          const current = sceneDraft.current;
          if (
            current.dirty &&
            (current.scene?.id !== latest?.id || current.scene?.version !== latest?.version)
          ) {
            // Never overwrite a local draft during a focus/network refresh.
            setSceneFresh(false);
            setSceneError(t("composer.sceneChanged"));
            return;
          }
          setScene((current) =>
            current?.id === latest?.id && current?.version === latest?.version ? current : latest,
          );
          setSceneReady(true);
          setSceneFresh(true);
          setSceneError(null);
        } catch {
          if (isCurrent(request)) setSceneError(t("composer.loadError"));
        }
      })(),
    ]);
    if (isCurrent(request)) setLoading(false);
  }, [clearPrivateData, collection, isCurrent, t]);

  const loadMore = async (list: "mine" | "feed") => {
    const request = requestVersion.current;
    const cursor = list === "mine" ? mineCursor : feedCursor;
    if (!cursor || moreInFlight.current || !isCurrent(request)) return;
    moreInFlight.current = true;
    setLoadingMore(list);
    setPageErrors((current) => ({ ...current, [list]: false }));
    try {
      const page = await privateStoriesApi[list === "mine" ? collection : list](cursor);
      if (!isCurrent(request)) return;
      const setItems = list === "mine" ? setMine : setFeed;
      setItems((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((existing) => existing.id === item.id)),
      ]);
      if (list === "mine") setMineCursor(page.nextCursor);
      else setFeedCursor(page.nextCursor);
    } catch {
      if (isCurrent(request)) setPageErrors((current) => ({ ...current, [list]: true }));
    } finally {
      if (isCurrent(request)) {
        moreInFlight.current = false;
        setLoadingMore(null);
      }
    }
  };
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const clear = () => {
        clearPrivateData();
        setOpenId(null);
        setAudienceSheetOpen(false);
        // An edit contains a fetched caption/media URL. Reopen it through detail
        // after returning; a new, locally authored draft can remain in memory.
        if (editingRef.current) {
          setEditing(null);
          setEditingMedia(null);
          setText("");
          setMedia(null);
          setSelected([]);
          setCommunityFilter(undefined);
          setShowManage(true);
        }
      };
      void load();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
        else clear();
      });
      return () => {
        focused.current = false;
        listener.remove();
        clear();
      };
    }, [clearPrivateData, load]),
  );

  useEffect(() => {
    const expiring = [...(collection === "mine" ? mine : []), ...feed];
    if (!expiring.length) return;
    const timer = setTimeout(
      () => {
        const active = (item: Story) => Date.parse(item.expiresAt) > Date.now();
        if (collection === "mine") setMine((items) => items.filter(active));
        setFeed((items) => items.filter(active));
      },
      Math.max(0, Math.min(...expiring.map((item) => Date.parse(item.expiresAt))) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [collection, mine, feed]);
  const collectionVersion = requestVersion.current;
  const updateOwnedStory = (id: string, updated: Story | null) => {
    if (!isCurrent(collectionVersion)) return;
    setMine((items) =>
      items.flatMap((item) =>
        item.id !== id
          ? [item]
          : updated &&
              (collection === "saved"
                ? !!updated.savedAt
                : Date.parse(updated.expiresAt) > Date.now())
            ? [{ ...item, ...updated }]
            : [],
      ),
    );
    if (!updated || (collection === "saved" && !updated.savedAt)) setOptionsId(null);
  };
  const groups = useMemo(() => {
    if (collection === "mine") return [{ key: "active", label: null, items: mine }];
    const months = new Map<string, { key: string; label: string; items: Story[] }>();
    for (const item of mine) {
      const posted = new Date(item.createdAt);
      const key = `${posted.getFullYear()}-${posted.getMonth()}`;
      if (!months.has(key))
        months.set(key, {
          key,
          label: posted.toLocaleDateString(language, { month: "long", year: "numeric" }),
          items: [],
        });
      months.get(key)!.items.push(item);
    }
    return [...months.values()];
  }, [collection, mine, language]);

  useEffect(() => {
    setPreview(null);
    setPreviewError(false);
    if (
      showManage ||
      mode !== "story" ||
      !storyEnabled ||
      loading ||
      (audience.audienceRule === "SELECTED" && !audience.recipientIds?.length)
    )
      return;
    let cancelled = false;
    const request = requestVersion.current;
    const timer = setTimeout(() => {
      void privateStoriesApi
        .preview(audience)
        .then((result) => {
          if (!cancelled && isCurrent(request)) setPreview(result);
        })
        .catch(() => {
          if (!cancelled && isCurrent(request)) setPreviewError(true);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience, showManage, mode, storyEnabled, loading, previewRetry, isCurrent]);

  const submitScene = async (input: SceneInput) => {
    const request = requestVersion.current;
    if (
      submitting.current ||
      loading ||
      !sceneFresh ||
      !sceneCapabilities?.enabled ||
      !isCurrent(request)
    )
      return;
    if (scene && Date.parse(scene.expiresAt) <= Date.now()) {
      setSceneFresh(false);
      setSceneError(t("composer.sceneChanged"));
      return;
    }
    submitting.current = true;
    setSceneSaving(true);
    setSceneError(null);
    try {
      const result =
        scene?.status === "ACTIVE" && Date.parse(scene.expiresAt) > Date.now()
          ? await scenesApi.update(scene.id, input)
          : await scenesApi.create(input);
      if (!isCurrent(request)) return;
      setScene(result.scene);
      setSceneDirty(false);
      // Publishing one mode must not throw away the other mode's draft.
      if (storyDirty) setMode("story");
      else {
        skipDiscard.current = true;
        router.back();
      }
    } catch (cause) {
      if (isCurrent(request))
        setSceneError(cause instanceof Error ? cause.message : t("scene.saveError"));
    } finally {
      submitting.current = false;
      setSceneSaving(false);
    }
  };

  const pickMedia = useCallback(
    async (kind: "images" | "videos") => {
      if (
        picking.current ||
        submitting.current ||
        !focused.current ||
        AppState.currentState !== "active"
      )
        return;
      picking.current = true;
      try {
        // The system picker grants access to selected files. Only iOS original
        // videos (Expo's default passthrough export) need library permission.
        if (Platform.OS === "ios" && kind === "videos") {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!focused.current || AppState.currentState !== "active") return;
          if (!permission.granted) {
            setError(
              t(
                permission.canAskAgain
                  ? "composer.videoPermission"
                  : "composer.videoPermissionSettings",
              ),
            );
            return;
          }
        }
        setError(null);
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: [kind],
          quality: 0.9,
          videoMaxDuration: 30,
          exif: false,
        });
        if (
          result.canceled ||
          !result.assets.length ||
          !focused.current ||
          AppState.currentState !== "active"
        )
          return;
        const asset = result.assets[0];
        const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
        // Android's picker can report the source asset size even after Expo has
        // copied or transformed it. The upload contract needs the actual bytes.
        const sizeBytes = new File(asset.uri).size || asset.fileSize || 0;
        if (!sizeBytes || sizeBytes > (mimeType.startsWith("image/") ? 10 : 40) * 1024 * 1024) {
          setError("Choose a photo under 10 MB or a video under 40 MB.");
          return;
        }
        if (
          !["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"].includes(
            mimeType,
          )
        ) {
          setError("This media format isn’t supported.");
          return;
        }
        setMedia({ uri: asset.uri, mimeType, sizeBytes });
        setTextMode(false);
        setError(null);
      } catch {
        if (focused.current && AppState.currentState === "active")
          setError("Couldn’t open your gallery. Try again.");
      } finally {
        picking.current = false;
      }
    },
    [t],
  );
  const save = async (confirmExpansion = false) => {
    const request = requestVersion.current;
    if (submitting.current || !storyEnabled || !isCurrent(request)) return;
    if (rule === "SELECTED" && !selected.length) {
      setAudienceSheetOpen(true);
      setError(t("composer.chooseAudience"));
      return;
    }
    if (!text.trim() && !media && !editingMedia) {
      setError(t("composer.addContent"));
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    setProgress(0);
    const signature = draftSignature;
    try {
      let awaitingReview = false;
      const checked = await privateStoriesApi.preview(audience);
      if (!isCurrent(request)) return;
      setPreview(checked);
      if (checked.eligibleCount === 0) {
        setError(t("composer.chooseAudience"));
        return;
      }
      if (editing) {
        const result = await privateStoriesApi.update(editing, {
          ...audience,
          text: text.trim(),
          ...(confirmExpansion ? { confirmAudienceExpansion: true } : {}),
        });
        awaitingReview = result.story.moderationStatus === "PENDING";
      } else {
        let uploaded;
        if (media) {
          const instruction = await privateStoriesApi.initiateMedia({
            mimeType: media.mimeType,
            sizeBytes: media.sizeBytes,
          });
          if (!isCurrent(request)) return;
          await uploadToPresignedUrl({
            uri: media.uri,
            mimeType: media.mimeType,
            uploadUrl: instruction.uploadUrl,
            uploadHeaders: instruction.uploadHeaders,
            onProgress: (value) => {
              if (isCurrent(request)) setProgress(value);
            },
          });
          if (!isCurrent(request)) return;
          uploaded = {
            objectKey: instruction.objectKey,
            uploadToken: instruction.uploadToken,
            mimeType: instruction.mimeType,
            sizeBytes: instruction.sizeBytes,
          };
        }
        const result = await privateStoriesApi.create({
          ...audience,
          text: text.trim(),
          ...(uploaded ? { media: uploaded } : {}),
        });
        awaitingReview = result.story.moderationStatus === "PENDING";
      }
      if (!isCurrent(request)) return;
      const wasEditing = !!editing;
      setText("");
      setMedia(null);
      setEditing(null);
      setEditingMedia(null);
      setPreview(null);
      setAudienceSheetOpen(false);
      setRule("ALL_APPROVED");
      setSelected([]);
      setCommunityFilter(undefined);
      setTextMode(false);
      if (awaitingReview || wasEditing || sceneDirty) {
        setShowManage(true);
        if (collection !== "mine") setCollection("mine");
        else void load();
        if (awaitingReview) Alert.alert(t("composer.reviewTitle"), t("composer.reviewBody"));
      } else {
        skipDiscard.current = true;
        router.back();
      }
    } catch (cause) {
      if (!isCurrent(request)) return;
      const message = cause instanceof Error ? cause.message : t("composer.shareError");
      if (editing && !confirmExpansion && message.includes("Review and confirm the new audience")) {
        Alert.alert(
          "Share with more people?",
          "These changes add approved people to this Story. They may see it until it expires. Do you want to expand the audience?",
          [
            { text: "Keep reviewing", style: "cancel" },
            {
              text: "Expand audience",
              onPress: () => {
                if (
                  isCurrent(request) &&
                  signature === liveDraft.current.signature &&
                  editing === liveDraft.current.editing
                )
                  void save(true);
              },
            },
          ],
        );
      } else setError(message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  const beginEdit = async (story: Story, discardConfirmed = false) => {
    if (storyDirty && !discardConfirmed) {
      Alert.alert(t("composer.discardTitle"), t("composer.discardBody"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("composer.discard"),
          style: "destructive",
          onPress: () => void beginEdit(story, true),
        },
      ]);
      return;
    }
    const request = requestVersion.current;
    try {
      const detail = await privateStoriesApi.detail(story.id);
      if (!isCurrent(request)) return;
      setEditing(story.id);
      setText(detail.story.text);
      setRule(detail.story.audienceRule);
      setCommunityFilter(detail.story.communityFilter ?? undefined);
      setSelected(detail.recipientIds ?? []);
      setMedia(null);
      setEditingMedia(
        detail.story.mediaUrl && detail.story.mediaMimeType
          ? { uri: detail.story.mediaUrl, mimeType: detail.story.mediaMimeType }
          : null,
      );
      setTextMode(!story.mediaMimeType);
      setMode("story");
      setShowManage(false);
      setAudienceSheetOpen(false);
      setPreview(null);
      editBaseline.current = JSON.stringify({
        text: detail.story.text,
        audience: {
          audienceRule: detail.story.audienceRule,
          ...(detail.story.audienceRule === "SELECTED"
            ? { recipientIds: detail.recipientIds ?? [] }
            : {}),
          ...(detail.story.communityFilter
            ? { communityFilter: detail.story.communityFilter }
            : {}),
        },
      });
    } catch {
      if (isCurrent(request)) setError("This Story is no longer available.");
    }
  };
  const toggle = (id: string) => {
    setPreview(null);
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };
  const displayedMedia = media ?? editingMedia;
  const startNew = () => {
    setError(null);
    setShowManage(false);
    setMode("story");
  };
  return (
    <>
      <SafeAreaView
        accessibilityElementsHidden={showManage}
        importantForAccessibility={showManage ? "no-hide-descendants" : "auto"}
        style={[
          styles.canvasRoot,
          { backgroundColor: palette.background },
          showManage && { display: "none" },
        ]}
        edges={["top", "bottom"]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          enabled={!audienceSheetOpen}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.canvasTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("composer.close")}
              disabled={busy}
              onPress={() => router.back()}
              style={styles.canvasIcon}
            >
              <Icon name="close" size={25} color={palette.textPrimary} />
            </Pressable>
            {editing ? (
              <Text variant="bodyStrong">{t("composer.editStory")}</Text>
            ) : (
              <View style={{ flex: 1 }}>
                <SegmentedControl
                  value={mode}
                  options={[
                    { value: "story", label: t("composer.story") },
                    { value: "scene", label: t("composer.scene") },
                  ]}
                  onChange={setMode}
                  disabled={busy}
                  accessibilityLabel={t("composer.mode")}
                  variant="underline"
                />
              </View>
            )}
            <View style={styles.canvasIcon} />
          </View>
          {mode === "scene" && (!sceneCapabilities?.enabled || !sceneReady) ? (
            <View style={styles.shareDock}>
              <Text color="textSubdued">
                {loading ? t("common.loading") : (sceneError ?? t("composer.unavailable"))}
              </Text>
              <Button
                label={t("common.retry")}
                variant="ghost"
                disabled={loading}
                onPress={() => void load()}
              />
            </View>
          ) : null}
          {sceneCapabilities?.enabled && sceneReady ? (
            <SceneComposerSheet
              visible={!showManage && mode === "scene"}
              scene={scene}
              busy={sceneSaving || loading}
              canPublish={sceneFresh}
              error={sceneError}
              lifetimeHours={sceneCapabilities.lifetimeHours}
              onDirtyChange={setSceneDirty}
              onBusyChange={setSceneUploading}
              onSubmit={(input) => void submitScene(input)}
            />
          ) : null}
          {mode === "scene" && sceneReady && sceneError && !sceneFresh ? (
            <Button
              label={t("common.retry")}
              variant="ghost"
              disabled={loading}
              onPress={() => void load()}
            />
          ) : null}
          {mode === "story" && !storyEnabled ? (
            <View style={styles.shareDock}>
              <Text color="textSubdued">
                {loading ? t("common.loading") : (error ?? t("composer.unavailable"))}
              </Text>
              <Button
                label={t("common.retry")}
                variant="ghost"
                disabled={loading}
                onPress={() => void load()}
              />
            </View>
          ) : null}
          {!showManage && mode === "story" && storyEnabled ? (
            <>
              <View
                style={[
                  styles.canvas,
                  { backgroundColor: displayedMedia ? palette.alwaysInk : palette.surface },
                ]}
              >
                {displayedMedia?.mimeType.startsWith("image/") ? (
                  <Image
                    source={displayedMedia.uri}
                    cachePolicy="none"
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                {displayedMedia?.mimeType.startsWith("video/") ? (
                  <SelectedVideoPreview uri={displayedMedia.uri} />
                ) : null}
                {!displayedMedia ? (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.emptyCanvas}
                  >
                    {textMode ? (
                      <TextInput
                        editable={!saving}
                        accessibilityLabel="Your Story text"
                        multiline
                        autoFocus
                        placeholder="Write your moment…"
                        placeholderTextColor={palette.textSubdued}
                        value={text}
                        onChangeText={setText}
                        maxLength={2000}
                        style={[styles.storyTextInput, { color: palette.textPrimary }]}
                      />
                    ) : (
                      <>
                        <Text variant="bodyStrong" color="textPrimary" align="center">
                          A moment for your people
                        </Text>
                        <Text variant="caption" color="textSubdued" align="center">
                          Choose a photo or video to begin
                        </Text>
                      </>
                    )}
                    <View style={styles.mediaChoices}>
                      {[
                        ...(!editing
                          ? [
                              {
                                label: "Photo",
                                accessibilityLabel: "Choose Story photo",
                                icon: "image" as IconName,
                                onPress: () => void pickMedia("images"),
                              },
                              {
                                label: "Video",
                                accessibilityLabel: "Choose Story video",
                                icon: "video" as IconName,
                                onPress: () => void pickMedia("videos"),
                              },
                            ]
                          : []),
                        ...(!textMode
                          ? [
                              {
                                label: "Text",
                                accessibilityLabel: "Create text Story",
                                icon: "edit" as IconName,
                                onPress: () => setTextMode(true),
                              },
                            ]
                          : []),
                      ].map((action) => (
                        <View key={action.label} style={styles.mediaChoice}>
                          <IconButton
                            accessibilityLabel={action.accessibilityLabel}
                            disabled={busy}
                            onPress={action.onPress}
                            size={40}
                            tone="neutral"
                          >
                            <Icon name={action.icon} size={22} color={palette.textPrimary} />
                          </IconButton>
                          <Text variant="micro" color="textSubdued">
                            {action.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <>
                    {!editing ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change Story media"
                        disabled={busy}
                        onPress={() =>
                          void pickMedia(
                            displayedMedia.mimeType.startsWith("video/") ? "videos" : "images",
                          )
                        }
                        style={[styles.changeMedia, { backgroundColor: palette.inkAlpha85 }]}
                      >
                        <Icon name="image" size={22} color={palette.alwaysWhite} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={textMode ? "Done editing Story text" : "Edit Story text"}
                      disabled={busy}
                      onPress={() => {
                        if (textMode) Keyboard.dismiss();
                        setTextMode((value) => !value);
                      }}
                      style={[styles.textTool, { backgroundColor: palette.inkAlpha85 }]}
                    >
                      {textMode ? (
                        <Icon name="check" size={22} color={palette.alwaysWhite} />
                      ) : (
                        <Text variant="bodyStrong" color="alwaysWhite">
                          Aa
                        </Text>
                      )}
                    </Pressable>
                    {textMode || text.trim() ? (
                      <View
                        style={[styles.storyTextOverlay, { backgroundColor: palette.inkAlpha85 }]}
                      >
                        {textMode ? (
                          <TextInput
                            editable={!saving}
                            accessibilityLabel="Your Story text"
                            placeholder="Write your moment…"
                            placeholderTextColor={palette.whiteAlpha42}
                            multiline
                            autoFocus
                            value={text}
                            onChangeText={setText}
                            maxLength={2000}
                            style={[styles.overlayInput, { color: palette.alwaysWhite }]}
                          />
                        ) : (
                          <Text color="alwaysWhite" style={styles.overlayText} numberOfLines={5}>
                            {text}
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
              <View style={styles.shareDock}>
                {previewError ? (
                  <>
                    <Text variant="caption" color="error" accessibilityRole="alert">
                      {t("composer.previewError")}
                    </Text>
                    <Button
                      label={t("common.retry")}
                      variant="ghost"
                      onPress={() => setPreviewRetry((value) => value + 1)}
                    />
                  </>
                ) : null}
                {error ? (
                  <Text variant="caption" color="error" accessibilityRole="alert">
                    {error}
                  </Text>
                ) : null}
                {saving && media ? (
                  <Text variant="caption" color="textSubdued" accessibilityLiveRegion="polite">
                    {t("composer.uploadProgress", { progress: Math.round(progress * 100) })}
                  </Text>
                ) : null}
                <View style={styles.shareActions}>
                  <IconButton
                    accessibilityLabel="Choose Story audience"
                    disabled={saving}
                    onPress={() => setAudienceSheetOpen(true)}
                    tone={rule === "SELECTED" ? "soft" : "neutral"}
                  >
                    <Icon
                      name="people"
                      size={22}
                      filled={rule === "SELECTED"}
                      color={rule === "SELECTED" ? palette.socialAccent : palette.textPrimary}
                    />
                  </IconButton>
                  <Button
                    label={t(editing ? "composer.saveStory" : "composer.shareStory")}
                    loading={saving}
                    disabled={
                      !preview || preview.eligibleCount === 0 || (!text.trim() && !displayedMedia)
                    }
                    onPress={() => void save()}
                  />
                </View>
              </View>

              <Modal
                visible={audienceSheetOpen}
                transparent
                animationType="slide"
                onRequestClose={() => {
                  if (!saving) setAudienceSheetOpen(false);
                }}
              >
                <View
                  ref={audienceRoot}
                  style={{ flex: 1 }}
                  onLayout={() => {
                    audienceRoot.current?.measureInWindow((_x, y, _width, height) => {
                      setAudienceBottom(y + height);
                    });
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close audience choices"
                    onPress={() => setAudienceSheetOpen(false)}
                    style={[styles.sheetScrim, { backgroundColor: palette.inkAlpha55 }]}
                  />
                  <KeyboardAvoidingView
                    style={[styles.sheetOverlay, { paddingBottom: audienceKeyboardInset }]}
                    pointerEvents="box-none"
                    enabled={Platform.OS === "ios"}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                  >
                    <SafeAreaView
                      edges={["bottom"]}
                      style={[styles.sheet, { backgroundColor: palette.background }]}
                    >
                      <View style={styles.sheetHeader}>
                        <View style={{ flex: 1 }}>
                          <Text variant="bodyStrong">{t("composer.shareWith")}</Text>
                          <Text variant="caption" color="textSubdued">
                            {t("composer.audiencePrivacy")}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Close audience choices"
                          onPress={() => setAudienceSheetOpen(false)}
                          style={styles.iconButton}
                        >
                          <Icon name="close" size={22} color={palette.textPrimary} />
                        </Pressable>
                      </View>
                      {/* Keep the focused input outside changing results so filtering
                        cannot clamp the scroll offset and move it while typing. */}
                      <View style={{ gap: 5 }}>
                        <NavigationListRow
                          first
                          label={t("composer.choosePeople")}
                          selected={rule === "SELECTED"}
                          selectionRole="radio"
                          onPress={() => {
                            setRule("SELECTED");
                            setPreview(null);
                          }}
                        />
                        <NavigationListRow
                          label={t("composer.allFriends")}
                          selected={rule === "ALL_APPROVED"}
                          selectionRole="radio"
                          onPress={() => {
                            setRule("ALL_APPROVED");
                            setPreview(null);
                          }}
                        />
                        {rule === "SELECTED" && people.length ? (
                          <Input
                            accessibilityLabel={t("composer.searchConnections")}
                            placeholder={t("composer.searchConnections")}
                            value={audienceSearch}
                            onChangeText={setAudienceSearch}
                            autoCorrect={false}
                            leftIcon={<Icon name="search" size={16} color={palette.textSubdued} />}
                          />
                        ) : null}
                      </View>
                      <ScrollView
                        style={styles.sheetScroll}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        contentContainerStyle={{ gap: 5, paddingBottom: 16 }}
                      >
                        {rule === "SELECTED" ? (
                          people.length ? (
                            <>
                              {filteredPeople.map((person) => (
                                <NavigationListRow
                                  key={person.id}
                                  label={person.displayName}
                                  selected={selected.includes(person.id)}
                                  selectionRole="checkbox"
                                  onPress={() => toggle(person.id)}
                                />
                              ))}
                              {!filteredPeople.length ? (
                                <Text variant="caption" color="textSubdued">
                                  {t("composer.noConnectionsFound")}
                                </Text>
                              ) : null}
                            </>
                          ) : (
                            <Text variant="caption" color="textSubdued">
                              Approve a follow request or match first.
                            </Text>
                          )
                        ) : null}
                        <NavigationListRow
                          label={filterOpen ? "Hide community filter" : "Optional community filter"}
                          icon="lock"
                          onPress={() => setFilterOpen((value) => !value)}
                        />
                        {filterOpen ? (
                          <View>
                            <Text variant="caption" color="textSubdued">
                              This only narrows your approved audience.
                            </Text>
                            <NavigationListRow
                              label="No community filter"
                              selected={!communityFilter}
                              onPress={() => {
                                setCommunityFilter(undefined);
                                setPreview(null);
                              }}
                              selectionRole="radio"
                            />
                            {communityLabels
                              .filter(
                                (item) =>
                                  item.value !== "PREFER_NOT_TO_SAY" &&
                                  item.value !== "SELF_DESCRIBE",
                              )
                              .map((item) => (
                                <NavigationListRow
                                  key={item.value}
                                  label={t(`story.community.label.${item.value}`)}
                                  selected={communityFilter === item.value}
                                  selectionRole="radio"
                                  onPress={() => {
                                    setCommunityFilter(item.value);
                                    setPreview(null);
                                  }}
                                />
                              ))}
                          </View>
                        ) : null}
                      </ScrollView>
                      <View style={styles.sheetFooter}>
                        <Text variant="caption" color="textSubdued" style={{ flex: 1 }}>
                          {rule === "SELECTED"
                            ? t("composer.peopleSelected", { count: selected.length })
                            : t("composer.approved")}
                        </Text>
                        <Button
                          label={t("composer.done")}
                          disabled={rule === "SELECTED" && selected.length === 0}
                          onPress={() => {
                            Keyboard.dismiss();
                            setAudienceSheetOpen(false);
                          }}
                        />
                      </View>
                    </SafeAreaView>
                  </KeyboardAvoidingView>
                </View>
              </Modal>
            </>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      {showManage ? (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: palette.background }}
          edges={["top", "bottom"]}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: layout.screenPadding,
                paddingBottom: spacing.xxl,
                gap: spacing.sm,
                maxWidth: layout.contentMaxWidth,
                width: "100%",
                alignSelf: "center",
              }}
            >
              <View>
                <View style={styles.header}>
                  <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
                    <Icon name="arrowLeft" size={22} color={palette.textPrimary} />
                  </IconButton>
                  <Text variant="titleSm" style={{ flex: 1 }} align="center">
                    {t("story.archive.title")}
                  </Text>
                  <IconButton
                    accessibilityLabel="Add a new Story"
                    disabled={!storyEnabled || busy}
                    tone="brand"
                    size={40}
                    onPress={startNew}
                  >
                    <Icon name="plus" size={24} color={palette.textOnBrand} />
                  </IconButton>
                </View>
                <SegmentedControl
                  value={collection}
                  variant="underline"
                  accessibilityLabel={t("story.archive.tabs")}
                  options={[
                    { value: "mine", label: t("story.archive.active") },
                    { value: "saved", label: t("story.archive.saved") },
                  ]}
                  onChange={setCollection}
                />
                <View style={styles.collectionHint}>
                  <Icon
                    name={collection === "saved" ? "bookmark" : "clock"}
                    size={18}
                    color={palette.textSubdued}
                  />
                  <Text variant="caption" color="textSubdued" style={{ flex: 1 }}>
                    {t(
                      collection === "saved"
                        ? "story.archive.privateHint"
                        : "story.archive.activeHint",
                    )}
                  </Text>
                </View>
              </View>
              {loading ? <Text color="textSubdued">Loading your Stories…</Text> : null}
              {error ? (
                <Text color="error" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              {error ? (
                <Button label="Try loading again" variant="secondary" onPress={() => void load()} />
              ) : null}
              {!mine.length && !loading && !error ? (
                <View style={[styles.galleryEmpty, !feed.length && styles.galleryEmptyFill]}>
                  <Icon name="image" size={32} color={palette.brand} />
                  <Text variant="titleSm" align="center">
                    {t(
                      collection === "saved"
                        ? "story.archive.emptySaved"
                        : "story.archive.emptyActive",
                    )}
                  </Text>
                  <Text
                    variant="body"
                    color="textSubdued"
                    align="center"
                    style={styles.galleryEmptyDescription}
                  >
                    {t(
                      collection === "saved"
                        ? "story.archive.emptySavedHint"
                        : "story.archive.emptyActiveHint",
                    )}
                  </Text>
                  <Button
                    label={t(editing || storyDirty ? "composer.resumeStory" : "composer.addStory")}
                    variant="secondary"
                    disabled={!storyEnabled || busy}
                    onPress={startNew}
                  />
                </View>
              ) : null}
              {groups.map((group) =>
                group.items.length ? (
                  <View key={group.key} style={styles.monthGroup}>
                    {group.label ? (
                      <Text variant="bodyStrong" accessibilityRole="header">
                        {group.label}
                      </Text>
                    ) : null}
                    <View style={styles.gallery}>
                      {group.items.map((story) => (
                        <View
                          key={story.id}
                          style={{
                            width: `${100 / galleryColumns}%`,
                            paddingHorizontal: spacing.xs,
                          }}
                        >
                          <View style={styles.galleryTile}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="View Story"
                              accessibilityHint={[
                                story.text || "Open your Story",
                                story.savedAt ? t("story.archive.savedIndicator") : "",
                                story.moderationStatus === "PENDING"
                                  ? "Awaiting review. Only you can see this"
                                  : story.moderationStatus === "REJECTED"
                                    ? "Not shared. Did not pass review"
                                    : "",
                                collection === "saved"
                                  ? t("story.archive.privateHint")
                                  : `Expires ${formatTimeOfDay(story.expiresAt)}`,
                              ]
                                .filter(Boolean)
                                .join(". ")}
                              onPress={() => setOpenId(story.id)}
                            >
                              <StoryGalleryPreview story={story} />
                              <LinearGradient
                                pointerEvents="none"
                                colors={[palette.mediaScrimTop, palette.mediaScrimBottom]}
                                style={styles.galleryScrim}
                              />
                              <Text
                                variant="micro"
                                color="alwaysWhite"
                                numberOfLines={2}
                                style={styles.galleryTime}
                              >
                                {collection === "saved"
                                  ? new Date(story.createdAt).toLocaleDateString(language, {
                                      day: "numeric",
                                      month: "short",
                                    })
                                  : formatRelativeTime(story.createdAt)}
                              </Text>
                            </Pressable>
                            {story.savedAt ? (
                              <View
                                pointerEvents="none"
                                accessibilityLabel={t("story.archive.savedIndicator")}
                                style={[styles.savedBadge, { backgroundColor: palette.surface }]}
                              >
                                <Icon name="bookmark" filled size={16} color={palette.brand} />
                              </View>
                            ) : null}
                            <View style={styles.galleryOptions}>
                              <IconButton
                                accessibilityLabel="Story options"
                                size={26}
                                onPress={() => setOptionsId(story.id)}
                              >
                                <Icon name="more" size={19} color={palette.alwaysWhite} />
                              </IconButton>
                            </View>
                          </View>
                          {story.moderationStatus !== "APPROVED" ? (
                            <Text variant="micro" color="textSubdued">
                              {story.moderationStatus === "PENDING"
                                ? "Awaiting review · only you"
                                : "Not shared · did not pass review"}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null,
              )}
              {mineCursor ? (
                <View style={{ gap: spacing.sm }}>
                  {pageErrors.mine ? (
                    <Text color="error" accessibilityRole="alert">
                      {t("story.pagination.error")}
                    </Text>
                  ) : null}
                  <Button
                    label={t(
                      loadingMore === "mine" ? "story.pagination.loading" : "story.pagination.mine",
                    )}
                    variant="ghost"
                    disabled={loadingMore !== null}
                    onPress={() => void loadMore("mine")}
                  />
                </View>
              ) : null}
              {collection === "mine" && feed.length ? (
                <Text variant="heading">Shared with you</Text>
              ) : null}
              {(collection === "mine" ? feed : []).map((story) => (
                <Pressable
                  key={story.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View private Story from ${story.ownerName ?? "Connection"}`}
                  onPress={() => setOpenId(story.id)}
                  style={[
                    styles.storyCard,
                    styles.cardTop,
                    { backgroundColor: palette.surface, borderColor: palette.borderSubdued },
                  ]}
                >
                  <View style={[styles.privateMark, { backgroundColor: palette.premiumSubdued }]}>
                    <Text variant="bodyStrong" color="premium">
                      {(story.ownerName ?? "C").slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{story.ownerName ?? "Connection"}</Text>
                    <Text variant="caption" color="textSubdued">
                      Private moment · tap to open
                    </Text>
                  </View>
                </Pressable>
              ))}
              {collection === "mine" && feedCursor ? (
                <View style={{ gap: spacing.sm }}>
                  {pageErrors.feed ? (
                    <Text color="error" accessibilityRole="alert">
                      {t("story.pagination.error")}
                    </Text>
                  ) : null}
                  <Button
                    label={t(
                      loadingMore === "feed" ? "story.pagination.loading" : "story.pagination.feed",
                    )}
                    variant="ghost"
                    disabled={loadingMore !== null}
                    onPress={() => void loadMore("feed")}
                  />
                </View>
              ) : null}
              <View style={styles.galleryTools}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Followers and following"
                  onPress={() => router.push("/(app)/private-stories/follows")}
                  style={styles.galleryTool}
                >
                  <Icon name="people" size={18} color={palette.textSubdued} />
                  <Text variant="captionStrong">Connections</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Community privacy"
                  onPress={() => router.push("/(app)/private-stories/community")}
                  style={styles.galleryTool}
                >
                  <Icon name="lock" size={17} color={palette.textSubdued} />
                  <Text variant="captionStrong">Privacy</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      ) : null}
      {showManage && optionsStory ? (
        <PrivateStoryOptionsSheet
          key={optionsStory.id}
          story={optionsStory}
          onClose={() => setOptionsId(null)}
          onChange={(updated) => updateOwnedStory(optionsStory.id, updated)}
          onEdit={(story) => void beginEdit(story)}
        />
      ) : null}
      <PrivateStoryViewer
        storyId={openId}
        onOwnerChange={(id, updated) => updateOwnedStory(id, updated)}
        onEdit={(story) => {
          setOpenId(null);
          void beginEdit(story);
        }}
        storyIds={(mine.some((story) => story.id === openId) ? mine : feed).map(
          (story) => story.id,
        )}
        onStoryChange={setOpenId}
        onClose={() => setOpenId(null)}
        canReport={!!openId && !mine.some((story) => story.id === openId)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  canvasRoot: { flex: 1 },
  canvas: {
    flex: 1,
    marginHorizontal: layoutTokens.compactScreenPadding,
    marginTop: spacing.sm,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  canvasTop: {
    minHeight: controlSize.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  canvasIcon: {
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCanvas: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  storyTextInput: {
    ...typography.bodyLarge,
    minHeight: controlSize.minimumTouchTarget * 2,
    width: "100%",
    textAlign: "center",
    textAlignVertical: "center",
    maxHeight: 240,
  },
  mediaChoices: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  mediaChoice: { alignItems: "center", gap: spacing.xs },
  changeMedia: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    borderRadius: radius.pill,
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  textTool: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    borderRadius: radius.pill,
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  storyTextOverlay: {
    position: "absolute",
    bottom: spacing.md + controlSize.minimumTouchTarget + spacing.sm,
    left: spacing.md,
    right: spacing.md,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: "45%",
  },
  overlayInput: { ...typography.body, minHeight: 36, maxHeight: 160, textAlignVertical: "center" },
  overlayText: { textAlign: "center" },
  shareDock: {
    width: "100%",
    maxWidth: layoutTokens.formMaxWidth,
    alignSelf: "center",
    paddingHorizontal: layoutTokens.compactScreenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  shareActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    height: "82%",
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  sheetScroll: { flex: 1 },
  sheetFooter: {
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  iconButton: {
    flexShrink: 0,
    width: controlSize.minimumTouchTarget,
    height: controlSize.minimumTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTools: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: spacing.md,
  },
  galleryTool: {
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    rowGap: spacing.sm,
  },
  galleryPreview: {
    aspectRatio: 3 / 5,
    borderRadius: radius.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  galleryOptions: { position: "absolute", bottom: 0, right: 0 },
  galleryTile: { borderRadius: radius.sm, overflow: "hidden" },
  galleryScrim: { position: "absolute", bottom: 0, left: 0, right: 0, height: "38%" },
  galleryTime: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.sm,
    right: controlSize.minimumTouchTarget,
  },
  savedBadge: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm,
    borderRadius: radius.xs,
    padding: spacing.xs,
  },
  monthGroup: { gap: spacing.md, marginBottom: spacing.md },
  collectionHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  galleryEmpty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl },
  galleryEmptyFill: { flexGrow: 1, justifyContent: "center" },
  galleryEmptyDescription: { maxWidth: 280 },
  privateMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  storyCard: { borderWidth: 1, borderRadius: 17, padding: 12, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
});
