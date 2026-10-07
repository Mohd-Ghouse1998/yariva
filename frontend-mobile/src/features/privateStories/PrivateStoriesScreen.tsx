import React, { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { privateStoriesApi, type Audience, type CommunityLabel, type Story, communityLabels } from "../../api/endpoints/privateStories";
import { uploadToPresignedUrl } from "../../api/upload";
import { Icon } from "../../components/ui/Icon";
import { PrivateStoryViewer } from "./PrivateStoryViewer";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { NavigationListRow } from "../../components/ui/NavigationList";
import { useTheme } from "../../theme/ThemeContext";
import { useResponsiveLayout } from "../../theme/responsive";
import { typography } from "../../theme/typography";
import { controlSize, radius, spacing } from "../../theme/spacing";

const SelectedVideoPreview: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, instance => { instance.loop = true; instance.muted = true; instance.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
};

export function PrivateStoriesScreen() {
  const router = useRouter();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const { palette } = useTheme();
  const layout = useResponsiveLayout();
  const [mine, setMine] = useState<Story[]>([]);
  const [feed, setFeed] = useState<Story[]>([]);
  const [people, setPeople] = useState<{ id: string; displayName: string }[]>([]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ uri: string; mimeType: string; sizeBytes: number } | null>(null);
  const [rule, setRule] = useState<Audience["audienceRule"]>("SELECTED");
  const [selected, setSelected] = useState<string[]>([]);
  const [communityFilter, setCommunityFilter] = useState<CommunityLabel | undefined>();
  const [, setPreview] = useState<{ eligibleCount: number; lifetimeHours: number } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState<{ uri: string; mimeType: string } | null>(null);
  const [showManage, setShowManage] = useState(compose !== "1");
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audience: Audience = { audienceRule: rule, ...(rule === "SELECTED" ? { recipientIds: selected } : {}), ...(communityFilter ? { communityFilter } : {}) };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [own, others, connections] = await Promise.all([privateStoriesApi.mine(), privateStoriesApi.feed(), privateStoriesApi.connections()]);
      setMine(own.items); setFeed(others.items); setPeople(connections.people);
      setFeedCursor(others.nextCursor);
    } catch { setError("Private Stories couldn’t load. Check your connection and try again."); }
    finally { setLoading(false); }
  }, []);
  const loadMore = async () => {
    if (!feedCursor || loadingMore) return;
    setLoadingMore(true); setError(null);
    try {
      const page = await privateStoriesApi.feed(feedCursor);
      setFeed(current => [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))]);
      setFeedCursor(page.nextCursor);
    } catch { setError("Couldn’t load more. Check your connection and try again."); }
    finally { setLoadingMore(false); }
  };
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pickMedia = useCallback(async (kind: "images" | "videos") => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError("Allow photo access to add a photo or video."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [kind], quality: 0.9, videoMaxDuration: 30, exif: false });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
      // Android's picker can report the source asset size even after Expo has
      // copied or transformed it. The upload contract needs the actual bytes.
      const sizeBytes = new File(asset.uri).size || asset.fileSize || 0;
      if (!sizeBytes || sizeBytes > (mimeType.startsWith("image/") ? 10 : 40) * 1024 * 1024) { setError("Choose a photo under 10 MB or a video under 40 MB."); return; }
      if (!["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"].includes(mimeType)) { setError("This media format isn’t supported."); return; }
      setMedia({ uri: asset.uri, mimeType, sizeBytes }); setTextMode(false); setError(null);
    } catch { setError("Couldn’t open your gallery. Try again."); }
  }, []);
  const save = async (confirmExpansion = false) => {
    if (!text.trim() && !media && !editing) { setError("Add a photo, video or words before sharing."); return; }
    setSaving(true); setError(null);
    try {
      const checked = await privateStoriesApi.preview(audience);
      if (checked.eligibleCount === 0) { setError("No approved connections can see this Story. Choose an audience first."); return; }
      if (editing) {
        await privateStoriesApi.update(editing, { ...audience, text: text.trim(), ...(confirmExpansion ? { confirmAudienceExpansion: true } : {}) });
      } else {
        let uploaded;
        if (media) {
          const instruction = await privateStoriesApi.initiateMedia({ mimeType: media.mimeType, sizeBytes: media.sizeBytes });
          await uploadToPresignedUrl({ uri: media.uri, mimeType: media.mimeType, uploadUrl: instruction.uploadUrl, uploadHeaders: instruction.uploadHeaders });
          uploaded = { objectKey: instruction.objectKey, uploadToken: instruction.uploadToken, mimeType: instruction.mimeType, sizeBytes: instruction.sizeBytes };
        }
        await privateStoriesApi.create({ ...audience, text: text.trim(), ...(uploaded ? { media: uploaded } : {}) });
      }
      const wasEditing = !!editing;
      setText(""); setMedia(null); setEditing(null); setEditingMedia(null); setPreview(null); setAudienceSheetOpen(false); await load();
      if (wasEditing) setShowManage(true); else router.back();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn’t share. Try again.";
      if (editing && !confirmExpansion && message.includes("Review and confirm the new audience")) {
        Alert.alert("Share with more people?", "These changes add approved people to this Story. They may see it until it expires. Do you want to expand the audience?", [
          { text: "Keep reviewing", style: "cancel" },
          { text: "Expand audience", onPress: () => void save(true) },
        ]);
      } else setError(message);
    }
    finally { setSaving(false); }
  };
  const confirmSave = () => {
    if (rule === "SELECTED" && selected.length === 0) {
      setAudienceSheetOpen(true);
      setError("Choose at least one approved connection before sharing.");
      return;
    }
    void privateStoriesApi.preview(audience).then(result => {
      if (result.eligibleCount === 0) {
        setAudienceSheetOpen(true);
        setError("Choose at least one approved connection before sharing.");
        return;
      }
      Alert.alert("Who can see this?", `${result.eligibleCount} approved ${result.eligibleCount === 1 ? "connection" : "connections"} can see this ${editing ? "updated " : ""}Private Story for ${result.lifetimeHours} hours. ${communityFilter ? "Only people privately opted into the selected community are included." : "New connections will not be added later."}`, [
        { text: "Review", style: "cancel", onPress: () => setAudienceSheetOpen(true) }, { text: editing ? "Save changes" : "Share privately", onPress: () => void save() },
      ]);
    }).catch(() => setError("Couldn’t check this audience. Try again."));
  };
  const remove = (story: Story) => Alert.alert("Delete Private Story?", "New Story opens stop immediately. A media link already opened may keep working for up to 60 seconds; someone may also have saved it.", [
    { text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void privateStoriesApi.remove(story.id).then(load).catch(() => setError("Couldn’t delete. Try again.")) },
  ]);
  const beginEdit = async (story: Story) => {
    try {
      const detail = await privateStoriesApi.detail(story.id);
      setEditing(story.id); setText(detail.story.text); setRule(story.audienceRule); setCommunityFilter(story.communityFilter ?? undefined);
      setSelected(detail.recipientIds ?? []); setMedia(null); setEditingMedia(detail.story.mediaUrl && detail.story.mediaMimeType ? { uri: detail.story.mediaUrl, mimeType: detail.story.mediaMimeType } : null); setTextMode(!story.mediaMimeType); setShowManage(false); setAudienceSheetOpen(true); setPreview(null);
    } catch { setError("This Story is no longer available."); }
  };
  const toggle = (id: string) => { setPreview(null); setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); };
  const displayedMedia = media ?? editingMedia;
  const startNew = () => { setEditing(null); setEditingMedia(null); setText(""); setMedia(null); setTextMode(false); setError(null); setShowManage(false); };
  if (!showManage) return <SafeAreaView style={[styles.canvasRoot, { backgroundColor: palette.alwaysInk }]} edges={["top", "bottom"]}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.canvas, { backgroundColor: displayedMedia ? palette.alwaysInk : palette.premiumSubdued }]}>
        {displayedMedia?.mimeType.startsWith("image/") ? <Image source={displayedMedia.uri} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
        {displayedMedia?.mimeType.startsWith("video/") ? <SelectedVideoPreview uri={displayedMedia.uri} /> : null}
        <View style={[styles.canvasTop, { backgroundColor: palette.inkAlpha85 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close Story composer" onPress={() => editing ? setShowManage(true) : router.back()} style={styles.canvasIcon}><Icon name="close" size={25} color={palette.alwaysWhite} /></Pressable>
          <View style={styles.canvasTitle}><Icon name="lock" size={13} color={palette.alwaysWhite} /><Text variant="captionStrong" color="alwaysWhite">{editing ? "EDIT STORY" : "NEW STORY"}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Your Stories and follow requests" onPress={() => setShowManage(true)} style={styles.canvasIcon}><Icon name="more" size={25} color={palette.alwaysWhite} /></Pressable>
        </View>
        {!displayedMedia ? <View style={styles.emptyCanvas}>
          <View style={[styles.emptyCanvasIcon, { backgroundColor: palette.ctaStart }]}><Icon name={textMode ? "edit" : "image"} size={28} color={palette.alwaysWhite} /></View>
          {textMode ? <TextInput accessibilityLabel="Your Story text" multiline autoFocus placeholder="Write your moment…" placeholderTextColor={palette.whiteAlpha42} value={text} onChangeText={setText} maxLength={2000} style={[styles.storyTextInput, { color: palette.alwaysWhite }]} /> : <><Text variant="title" color="alwaysWhite" align="center">A moment for your people</Text><Text variant="caption" color="alwaysWhite" align="center">Choose a photo or video to begin</Text></>}
          <View style={styles.mediaChoices}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose Story photo" onPress={() => void pickMedia("images")} style={[styles.pickButton, { backgroundColor: palette.alwaysWhite }]}><Icon name="image" size={18} color={palette.alwaysInk} /><Text variant="bodyStrong" color="alwaysInk">Photo</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose Story video" onPress={() => void pickMedia("videos")} style={[styles.pickButton, { backgroundColor: palette.alwaysWhite }]}><Icon name="video" size={18} color={palette.alwaysInk} /><Text variant="bodyStrong" color="alwaysInk">Video</Text></Pressable>
          </View>
          {!textMode ? <Pressable accessibilityRole="button" accessibilityLabel="Create text Story" onPress={() => setTextMode(true)} style={styles.textStoryButton}><Text variant="captionStrong" color="alwaysWhite">Write a Story</Text></Pressable> : null}
        </View> : <>
          {!editing ? <Pressable accessibilityRole="button" accessibilityLabel="Change Story media" onPress={() => void pickMedia(displayedMedia.mimeType.startsWith("video/") ? "videos" : "images")} style={[styles.changeMedia, { backgroundColor: palette.inkAlpha85 }]}><Icon name="image" size={17} color={palette.alwaysWhite} /><Text variant="captionStrong" color="alwaysWhite">Change</Text></Pressable> : null}
          <View style={[styles.captionBar, { backgroundColor: palette.inkAlpha85 }]}><TextInput accessibilityLabel="Story caption" placeholder="Add a caption…" placeholderTextColor={palette.whiteAlpha42} multiline value={text} onChangeText={setText} maxLength={2000} style={[styles.captionInput, { color: palette.alwaysWhite }]} /></View>
        </>}
      </View>
      <View style={styles.shareDock}>
        <Text variant="caption" color="alwaysWhite">Private · expires 24 hours after sharing</Text>
        {error ? <Text variant="caption" color="alwaysWhite" accessibilityRole="alert">{error}</Text> : null}
        <View style={styles.shareActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose Story audience" onPress={() => setAudienceSheetOpen(true)} style={[styles.audiencePill, { backgroundColor: palette.whiteAlpha42 }]}><Icon name="lock" size={15} color={palette.alwaysWhite} /><Text variant="captionStrong" color="alwaysWhite" numberOfLines={1}>{rule === "ALL_APPROVED" ? "Approved people" : selected.length ? `${selected.length} ${selected.length === 1 ? "person" : "people"}` : "Choose people"}</Text><Icon name="chevronDown" size={14} color={palette.alwaysWhite} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={editing ? "Review Story changes" : "Review and share Story"} disabled={saving || (!editing && !media && !text.trim())} onPress={confirmSave} style={[styles.shareButton, { backgroundColor: saving || (!editing && !media && !text.trim()) ? palette.whiteAlpha42 : palette.ctaStart }]}><Text variant="bodyStrong" color="alwaysWhite">{saving ? "Sharing…" : editing ? "Review" : "Share Story"}</Text><Icon name="arrowUp" size={18} color={palette.alwaysWhite} /></Pressable>
        </View>
      </View>
      <Modal visible={audienceSheetOpen} transparent animationType="slide" onRequestClose={() => setAudienceSheetOpen(false)}><View style={styles.sheetOverlay}><Pressable accessibilityRole="button" accessibilityLabel="Close audience choices" onPress={() => setAudienceSheetOpen(false)} style={[styles.sheetScrim, { backgroundColor: palette.inkAlpha55 }]} /><SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: palette.background }]}>
        <View style={styles.sheetHeader}><View><Text variant="heading">Share with</Text><Text variant="caption" color="textSubdued">Only approved connections can see this Story.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close audience choices" onPress={() => setAudienceSheetOpen(false)} style={styles.iconButton}><Icon name="close" size={22} color={palette.textPrimary} /></Pressable></View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={{ gap: 5, paddingBottom: 16 }}><NavigationListRow label="Choose people" selected={rule === "SELECTED"} selectionRole="radio" onPress={() => { setRule("SELECTED"); setPreview(null); }} />{rule === "SELECTED" ? people.length ? people.map(person => <NavigationListRow key={person.id} label={person.displayName} selected={selected.includes(person.id)} selectionRole="checkbox" onPress={() => toggle(person.id)} />) : <Text variant="caption" color="textSubdued">Approve a follow request or match first.</Text> : null}<NavigationListRow label="All approved connections now" selected={rule === "ALL_APPROVED"} selectionRole="radio" onPress={() => { setRule("ALL_APPROVED"); setPreview(null); }} /><Button label={filterOpen ? "Hide community filter" : "Optional community filter"} variant="ghost" onPress={() => setFilterOpen(value => !value)} />{filterOpen ? <View><Text variant="caption" color="textSubdued">This only narrows your approved audience.</Text><NavigationListRow label="No community filter" selected={!communityFilter} onPress={() => { setCommunityFilter(undefined); setPreview(null); }} selectionRole="radio" />{communityLabels.filter(item => item.value !== "PREFER_NOT_TO_SAY" && item.value !== "SELF_DESCRIBE").map(item => <NavigationListRow key={item.value} label={item.label} selected={communityFilter === item.value} selectionRole="radio" onPress={() => { setCommunityFilter(item.value); setPreview(null); }} />)}</View> : null}</ScrollView>
        <View style={styles.sheetFooter}><Button label="Done" onPress={() => setAudienceSheetOpen(false)} /></View>
      </SafeAreaView></View></Modal>
      <PrivateStoryViewer storyId={openId} onClose={() => setOpenId(null)} canReport={!!openId && !mine.some(story => story.id === openId)} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={["top", "bottom"]}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingBottom: 32, gap: 14, maxWidth: layout.contentMaxWidth, width: "100%", alignSelf: "center" }}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><Icon name="arrowLeft" size={23} color={palette.textPrimary} /></Pressable><Text variant="titleSm">Private Stories</Text><Pressable accessibilityRole="button" accessibilityLabel="Community privacy" onPress={() => router.push("/(app)/private-stories/community")} style={styles.iconButton}><Icon name="settings" size={21} color={palette.textPrimary} /></Pressable></View>
        <Text variant="caption" color="textSubdued">A moment for your people. Gone in 24 hours.</Text>
        {loading ? <Text>Loading private Stories…</Text> : null}
        {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
        {error ? <Button label="Try loading again" variant="secondary" onPress={() => void load()} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Add a new Story" onPress={startNew} style={[styles.newStory, { backgroundColor: palette.ctaStart }]}><Icon name="plus" size={18} color={palette.alwaysWhite} /><Text variant="bodyStrong" color="alwaysWhite">Add Story</Text></Pressable>
        <NavigationListRow label="Followers and following" value="Manage" onPress={() => router.push("/(app)/private-stories/follows")} />
        <Text variant="heading">Your Stories</Text>
        {!mine.length && !loading ? <Text color="textSubdued">Your next moment will appear here.</Text> : null}
        {mine.map(story => <View key={story.id} style={[styles.storyCard, styles.cardTop, { backgroundColor: palette.surface, borderColor: palette.borderSubdued }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="View Story" onPress={() => setOpenId(story.id)} style={[styles.cardTop, { flex: 1 }]}><View style={[styles.privateMark, { backgroundColor: palette.brandSubdued }]}><Icon name={story.mediaMimeType?.startsWith("video/") ? "video" : story.mediaMimeType ? "image" : "sparkle"} size={18} color={palette.brand} /></View><View style={{ flex: 1 }}><Text variant="bodyStrong" numberOfLines={1}>{story.text || (story.mediaMimeType?.startsWith("video/") ? "Your video Story" : story.mediaMimeType ? "Your photo Story" : "Your Story")}</Text><Text variant="caption" color="textSubdued">Expires {new Date(story.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit Story audience or text" onPress={() => void beginEdit(story)} style={styles.cardAction}><Icon name="edit" size={20} color={palette.textPrimary} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete Story" onPress={() => remove(story)} style={styles.cardAction}><Icon name="trash" size={20} color={palette.textSubdued} /></Pressable>
        </View>)}
        {feed.length ? <Text variant="heading">Shared with you</Text> : null}
        {feed.map(story => <Pressable key={story.id} onPress={() => setOpenId(story.id)} style={[styles.storyCard, styles.cardTop, { backgroundColor: palette.surface, borderColor: palette.borderSubdued }]}><View style={[styles.privateMark, { backgroundColor: palette.premiumSubdued }]}><Text variant="bodyStrong" color="premium">{(story.ownerName ?? "C").slice(0, 1)}</Text></View><View><Text variant="bodyStrong">{story.ownerName ?? "Connection"}</Text><Text variant="caption" color="textSubdued">Private moment · tap to open</Text></View></Pressable>)}
        {feedCursor ? <Button label={loadingMore ? "Loading…" : "More Stories"} variant="ghost" disabled={loadingMore} onPress={() => void loadMore()} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    <PrivateStoryViewer storyId={openId} onClose={() => setOpenId(null)} canReport={!!openId && !mine.some(story => story.id === openId)} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  canvasRoot: { flex: 1 },
  canvas: { flex: 1, marginHorizontal: 10, marginTop: 6, borderRadius: 22, overflow: "hidden" },
  canvasTop: { position: "absolute", top: 0, left: 0, right: 0, height: 58, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 },
  canvasIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  canvasTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  emptyCanvas: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 28 },
  emptyCanvasIcon: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  storyTextInput: { ...typography.display, minHeight: 150, width: "100%", textAlign: "center", textAlignVertical: "center", maxHeight: 280 },
  mediaChoices: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  pickButton: { minHeight: controlSize.minimumTouchTarget, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  textStoryButton: { minHeight: controlSize.minimumTouchTarget, justifyContent: "center", paddingHorizontal: spacing.md },
  changeMedia: { position: "absolute", top: 72, right: 12, borderRadius: radius.xl, paddingHorizontal: spacing.md, minHeight: controlSize.minimumTouchTarget, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  captionBar: { position: "absolute", bottom: 12, left: 12, right: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, minHeight: 54, maxHeight: 130 },
  captionInput: { ...typography.body, minHeight: 36, maxHeight: 110, textAlignVertical: "center" },
  shareDock: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 8, gap: 7 },
  shareActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  audiencePill: { minHeight: 48, maxWidth: "48%", borderRadius: 25, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  shareButton: { flex: 1, minHeight: 48, borderRadius: 25, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { maxHeight: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 13 },
  sheetScroll: { flexGrow: 0 },
  sheetFooter: { paddingTop: 10, paddingBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  iconButton: { width: controlSize.minimumTouchTarget, height: controlSize.minimumTouchTarget, alignItems: "center", justifyContent: "center" },
  newStory: { minHeight: controlSize.minimumTouchTarget, borderRadius: radius.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  privateMark: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  storyCard: { borderWidth: 1, borderRadius: 17, padding: 12, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardAction: { width: controlSize.minimumTouchTarget, height: controlSize.minimumTouchTarget, alignItems: "center", justifyContent: "center" },
});
