import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputKeyPressEventData,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { analyticsApi } from "../../api/endpoints/analytics";
import { conversationsApi } from "../../api/endpoints/conversations";
import { callsApi } from "../../api/endpoints/calls";
import { useLocalization } from "../../localization/LocalizationContext";
import { matchesApi } from "../../api/endpoints/matches";
import { messagesApi } from "../../api/endpoints/messages";
import { safetyApi } from "../../api/endpoints/safety";
import { createPersistablePreviewUri, uploadToPresignedUrl } from "../../api/upload";
import { useAuth } from "../../auth/AuthContext";
import { MessageBubble, TypingIndicator } from "../../components/chat/MessageBubble";
import { Avatar } from "../../components/ui/Avatar";
import { Button, ButtonRow } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Icon, type IconName } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useCallManager } from "../calls/CallManager";
import { BlindConversationBanner } from "../blind/BlindConversationBanner";
import { BlockConfirmModal } from "../safety/BlockConfirmModal";
import { useRealtime } from "../../realtime/RealtimeProvider";
import { isFixturesEnabled } from "../../dev/fixtureRouter";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { shadows } from "../../theme/shadows";
import { spacing } from "../../theme/spacing";
import { fontFamilies } from "../../theme/typography";
import type { ConversationDetailDto, MessageDto } from "../../types/conversation";
import type { MatchDetailDto } from "../../types/match";
import type { PublicProfileDto } from "../../types/profile";
import { DuoMembersDialog } from "./DuoMembersDialog";
import {
  isMessageImageMimeType,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  normalizeUploadFileName,
} from "../../types/media";
import {
  canSendMessage,
  CHAT_COMPOSER_GAP,
  CHAT_TOUCH_TARGET,
  constrainMessageInput,
  getConversationRenderState,
  getSelectedAttachmentAsset,
  isConversationWritable,
  MESSAGE_COUNTER_THRESHOLD,
  MESSAGE_MAX_LENGTH,
  shouldSendFromKey,
  sortMessages,
  upsertMessage,
} from "./chatLogic";

// Same transparent mark as the splash and match celebration; kept quiet behind chat content.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const petalArtwork = require("../../../assets/brand/petal-artwork.png");

const ConversationOption: React.FC<{
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  accent?: boolean;
}> = ({ icon, label, onPress, danger = false, accent = false }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const iconColor = danger ? palette.error : accent ? palette.textBrand : palette.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        accent ? styles.optionRowAccent : null,
        pressed ? styles.optionRowPressed : null,
      ]}
    >
      <View style={[styles.optionIcon, accent ? styles.optionIconAccent : null, danger ? styles.optionIconDanger : null]}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <Text variant={accent ? "bodyStrong" : "body"} color={danger ? "error" : "textPrimary"} style={styles.optionLabel}>
        {label}
      </Text>
    </Pressable>
  );
};

// Mirrors aroha_ui_deisgn_files/chat.jsx > ScreenChat. Header with back +
// avatar + name + Active-now status + phone/video/more, scrollable
// messages list with "You matched on …" header chip, gradient own bubbles,
// typing indicator while partner is typing, paperclip/smile/send composer.
export const ChatScreen: React.FC = () => {
  const { palette, resolved } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId: string; helloEnded?: string }>();
  const { t } = useLocalization();
  const conversationId = params.conversationId;
  const { user, tokens } = useAuth();
  const realtime = useRealtime();
  const callManager = useCallManager();
  const toast = useToast();
  const goBack = useSafeBack("/(app)/(tabs)/chats");

  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetailDto | null>(null);
  const [callSettingsStatus, setCallSettingsStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [failedMessageIds, setFailedMessageIds] = useState<ReadonlySet<string>>(() => new Set());
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState<"ONLINE" | "OFFLINE" | null>(null);
  const [partnerLastReadSeq, setPartnerLastReadSeq] = useState(0);
  const [memberReads, setMemberReads] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [helloEnabled, setHelloEnabled] = useState(false);
  const [blindActive, setBlindActive] = useState(false);
  const [helloOpen, setHelloOpen] = useState(false);
  const [helloBusy, setHelloBusy] = useState(false);
  const [helloReturn, setHelloReturn] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [safetyMember, setSafetyMember] = useState<PublicProfileDto | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightMessageIds = useRef(new Set<string>());
  const previousRealtimeStatus = useRef(realtime.status);

  const sortedMessages = useMemo(() => sortMessages(messages), [messages]);
  const lastMineSeq = useMemo(
    () =>
      sortedMessages
        .filter((m) => m.senderId === user?.id)
        .reduce((max, m) => Math.max(max, m.sequence), 0),
    [sortedMessages, user?.id],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setMatchDetail(null);
    setCallSettingsStatus("loading");
    if (!conversationId) {
      setConversation(null);
      setLoadError("This conversation link is incomplete.");
      setLoading(false);
      return;
    }
    try {
      const [c, m] = await Promise.all([
        conversationsApi.get(conversationId),
        conversationsApi.messages(conversationId, { limit: 50 }),
      ]);
      setConversation(c);
      setHelloEnabled(c.kind !== "DUO" && (await callsApi.capabilities().catch(() => ({ voiceIntroductionsEnabled: false }))).voiceIntroductionsEnabled);
      setMemberReads(Object.fromEntries((c.readStates ?? []).map(read => [read.userId, read.lastReadSequence])));
      setMessages(m.items);
      try {
        setMatchDetail(c.matchId ? await matchesApi.get(c.matchId) : null);
        setCallSettingsStatus("ready");
      } catch {
        setMatchDetail(null);
        setCallSettingsStatus("error");
      }
      setFailedMessageIds(new Set());
      const latest = m.items.reduce((acc, msg) => Math.max(acc, msg.sequence), 0);
      if (latest > 0) {
        await conversationsApi
          .read(conversationId, { lastReadSequence: latest })
          .catch(() => undefined);
      }
    } catch {
      setConversation(null);
      setCallSettingsStatus("error");
      setLoadError("We couldn’t load this conversation. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));
  useEffect(() => {
    if (params.helloEnded === "1") { setHelloReturn(true); router.setParams({ helloEnded: undefined }); }
  }, [params.helloEnded, router]);

  useEffect(() => {
    const previous = previousRealtimeStatus.current;
    previousRealtimeStatus.current = realtime.status;
    if (
      !isFixturesEnabled() &&
      realtime.status === "connected" &&
      (previous === "reconnecting" || previous === "disconnected")
    ) {
      void load();
    }
  }, [load, realtime.status]);

  useEffect(() => {
    const offCreated = realtime.onMessageCreated(({ message, conversationId: cid }) => {
      if (cid !== conversationId || message.conversationId !== conversationId) return;
      setMessages((prev) => upsertMessage(prev, message));
      if (conversationId && message.senderId !== user?.id) {
        void conversationsApi
          .read(conversationId, { lastReadSequence: message.sequence })
          .catch(() => undefined);
      }
    });
    const offClosed = realtime.onConversationClosed(({ conversationId: cid }) => {
      if (cid !== conversationId) return;
      setMessages([]);
      setConversation(null);
      setMembersOpen(false);
      setMenuOpen(false);
      setLoadError("This conversation is no longer available.");
    });
    const offUpdated = realtime.onMessageUpdated(({ message }) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => upsertMessage(prev, message));
    });
    const offDeleted = realtime.onMessageDeleted(({ conversationId: cid, messageId }) => {
      if (cid !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "DELETED_BY_SENDER" } : m)),
      );
    });
    const offTyping = realtime.onTyping(({ conversationId: cid, userId, isTyping }) => {
      if (cid !== conversationId || userId === user?.id) return;
      setPartnerTyping(isTyping);
    });
    const offRead = realtime.onConversationRead(({ conversationId: cid, readState }) => {
      if (cid !== conversationId || readState.userId === user?.id) return;
      setPartnerLastReadSeq(readState.lastReadSequence);
      setMemberReads(current => ({ ...current, [readState.userId]: Math.max(current[readState.userId] ?? 0, readState.lastReadSequence) }));
    });
    const offPresence = realtime.onPresence(({ userId, status }) => {
      if (userId !== conversation?.otherUser.userId) return;
      setPartnerPresence(status);
    });
    return () => {
      offCreated();
      offClosed();
      offUpdated();
      offDeleted();
      offTyping();
      offRead();
      offPresence();
      setPartnerTyping(false);
      setPartnerPresence(null);
    };
  }, [conversation?.otherUser.userId, conversationId, realtime, user?.id]);

  useEffect(() => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [sortedMessages.length, partnerTyping]);

  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (conversationId) {
        realtime.emit("conversation.typing.stop", { conversationId });
      }
    },
    [conversationId, realtime],
  );

  const onTextChange = (next: string) => {
    const constrained = constrainMessageInput(next);
    setText(constrained);
    if (!conversationId) return;
    if (!constrained.trim()) {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      realtime.emit("conversation.typing.stop", { conversationId });
      return;
    }
    realtime.emit("conversation.typing.start", { conversationId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      realtime.emit("conversation.typing.stop", { conversationId });
    }, 1500);
  };

  const deliverMessage = async (optimistic: MessageDto, isFirstMessage: boolean) => {
    const deliveryId = optimistic.clientMessageId ?? optimistic.id;
    if (!conversationId || inFlightMessageIds.current.has(deliveryId)) return;
    inFlightMessageIds.current.add(deliveryId);
    setFailedMessageIds((current) => {
      const next = new Set(current);
      next.delete(deliveryId);
      return next;
    });
    setSending(true);
    try {
      const response = await conversationsApi.send(conversationId, {
        textBody: optimistic.textBody?.slice(0, MESSAGE_MAX_LENGTH) ?? "",
        clientMessageId: deliveryId,
      });
      setMessages((current) => upsertMessage(current, response));
      if (isFirstMessage) {
        void analyticsApi
          .ingest([{ name: "first_message_sent", contextId: conversationId }])
          .catch(() => undefined);
      }
    } catch {
      setFailedMessageIds((current) => new Set(current).add(deliveryId));
      toast.show("Message wasn’t sent.", "error", {
        label: "Retry",
        onPress: () => deliverMessage(optimistic, false),
      });
    } finally {
      inFlightMessageIds.current.delete(deliveryId);
      setSending(false);
    }
  };

  const onSend = async () => {
    if (!conversationId || !canSendMessage(text, sending)) return;
    const messageText = constrainMessageInput(text).trim();
    if (!messageText) return;
    const isFirstMessage = sortedMessages.length === 0;
    const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: MessageDto = {
      id: clientMessageId,
      conversationId,
      senderId: user?.id ?? "me",
      sequence: (sortedMessages[sortedMessages.length - 1]?.sequence ?? 0) + 0.5,
      clientMessageId,
      type: "TEXT",
      textBody: messageText,
      attachment: {
        objectKey: null,
        url: null,
        mimeType: null,
        sizeBytes: null,
        width: null,
        height: null,
        durationSeconds: null,
        moderationStatus: null,
      },
      status: "PENDING_MODERATION",
      replyToMessageId: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessages((current) => upsertMessage(current, optimistic));
    setText("");
    realtime.emit("conversation.typing.stop", { conversationId });
    await deliverMessage(optimistic, isFirstMessage);
  };

  const onComposerKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData & { shiftKey?: boolean }> & {
      shiftKey?: boolean;
    },
  ) => {
    const shiftKey = event.nativeEvent.shiftKey ?? event.shiftKey ?? false;
    if (
      shouldSendFromKey({
        platform: Platform.OS,
        key: event.nativeEvent.key,
        shiftKey,
      })
    ) {
      event.preventDefault();
      void onSend();
    }
  };

  const onAttach = async () => {
    if (blindActive) { toast.show("Reveal photos together before sharing images.", "info"); return; }
    if (!conversationId || attaching) return;
    setAttaching(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show("Photo access is needed to attach an image.", "warning");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      const asset = getSelectedAttachmentAsset(result);
      if (!asset) return;
      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!isMessageImageMimeType(mimeType)) {
        toast.show("Choose a JPEG, PNG, or WebP image.", "warning");
        return;
      }
      const sizeBytes = asset.fileSize ?? 1;
      if (sizeBytes > MESSAGE_ATTACHMENT_MAX_BYTES) {
        toast.show("Choose an image smaller than 50 MB.", "warning");
        return;
      }
      const init = await messagesApi.initiateAttachment({
        conversationId,
        fileName: normalizeUploadFileName(asset.fileName, `message-${Date.now()}.jpg`),
        mimeType,
        sizeBytes,
      });
      await uploadToPresignedUrl({
        uri: asset.uri,
        uploadUrl: init.uploadUrl,
        uploadHeaders: init.headers,
        mimeType,
      });
      const fixturePreviewUri = isFixturesEnabled()
        ? await createPersistablePreviewUri(asset.uri, mimeType)
        : undefined;
      const message = await messagesApi.finalizeAttachment({
        conversationId,
        clientMessageId: `image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "IMAGE",
        uploadToken: init.uploadToken,
        objectKey: init.objectKey,
        bucket: init.bucket,
        mimeType,
        sizeBytes,
        width: asset.width,
        height: asset.height,
        fixturePreviewUri,
      });
      setMessages((current) => upsertMessage(current, message));
      toast.show("Photo sent.", "success");
    } catch {
      toast.show("Couldn’t send image.", "error");
    } finally {
      setAttaching(false);
    }
  };

  const renderState = getConversationRenderState({
    loading,
    hasConversation: Boolean(conversation),
    hasError: Boolean(loadError),
  });

  if (renderState === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.loadingState}>
          <ActivityIndicator color={palette.brand} />
          <Text variant="body" color="textSubdued">
            Loading conversation…
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (renderState === "error" || !conversation) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.errorState}>
          <View style={styles.errorIcon}>
            <Icon name="chat" size={28} color={palette.textBrand} />
          </View>
          <Text variant="heading" align="center">
            Conversation unavailable
          </Text>
          <Text variant="body" color="textSubdued" align="center">
            {loadError ?? "We couldn’t find this conversation."}
          </Text>
          <View style={styles.errorActions}>
            <Button label="Try again" fullWidth onPress={() => void load()} />
            <Button label="Back to Chats" variant="secondary" fullWidth onPress={goBack} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const closed = !isConversationWritable(conversation.status);
  const partner = conversation.otherUser;
  const isDuo = conversation.kind === "DUO";
  const chatName = isDuo ? "Duo chat" : partner.displayName;
  const members = conversation.participants ?? [partner];
  const seenCount = members.filter(member => member.userId !== user?.id && (memberReads[member.userId] ?? 0) >= lastMineSeq).length;
  const blockTarget = safetyMember ?? partner;
  const isEmpty = sortedMessages.length === 0;
  const allowsVoice = Boolean(
    matchDetail?.myCommunicationSetting.allowVoiceCalls &&
    matchDetail.otherUserCommunicationAllowed.allowVoiceCalls,
  );
  const allowsVideo = Boolean(
    matchDetail?.myCommunicationSetting.allowVideoCalls &&
    matchDetail.otherUserCommunicationAllowed.allowVideoCalls,
  );
  const partnerPhoto =
    partner.photos.find((photo) => photo.isPrimary)?.url ?? partner.photos[0]?.url;
  const composerCanSend = canSendMessage(text, sending);
  const openDatePlanner = () => {
    if (isDuo) { router.push({ pathname: "/(app)/duo-plans/[conversationId]", params: { conversationId: conversation.id } }); return; }
    if (conversation.matchId) router.push({ pathname: "/(app)/date-plan/new", params: { matchId: conversation.matchId } });
  };

  const startCall = (callType: "VOICE" | "VIDEO") => {
    if (!conversation.matchId) return;
    if (callSettingsStatus === "loading") {
      toast.show("Call settings are still loading. Please try again in a moment.", "info");
      return;
    }
    if (callSettingsStatus === "error") {
      toast.show(
        "We couldn’t check call permissions. Check your connection and try again.",
        "error",
      );
      return;
    }
    const allowed = callType === "VOICE" ? allowsVoice : allowsVideo;
    if (!allowed) {
      toast.show(
        `${callType === "VOICE" ? "Voice" : "Video"} calling is turned off for this match.`,
        "info",
      );
      return;
    }
    void callManager
      .startOutgoingCall({ matchId: conversation.matchId, callType })
      .catch((error) =>
        toast.show(error instanceof Error ? error.message : "Couldn’t start call.", "error"),
      );
  };

  const callAccessibilityLabel = (callType: "VOICE" | "VIDEO", allowed: boolean) => {
    const label = callType === "VOICE" ? "Voice" : "Video";
    if (callSettingsStatus === "loading") return `${label} call settings loading`;
    if (callSettingsStatus === "error") return `${label} calls unavailable`;
    return allowed
      ? `Start ${label.toLowerCase()} call`
      : `${label} calls turned off for this match`;
  };

  const onBlockPartner = async () => {
    setBlocking(true);
    try {
      await safetyApi.block({
        blockedUserId: blockTarget.userId,
        reason: "Blocked from conversation",
      });
      setBlockOpen(false);
      toast.show(`${blockTarget.displayName} blocked`, "success");
      router.replace("/(app)/(tabs)/chats");
    } catch {
      toast.show("Couldn’t block this person.", "error");
    } finally {
      setBlocking(false);
    }
  };

  const sayHello = async () => {
    if (helloBusy || !conversation.matchId || !allowsVoice) return;
    setHelloBusy(true);
    try { await callManager.startOutgoingCall({ matchId: conversation.matchId, callType: "VOICE", purpose: "VOICE_INTRODUCTION" }); setHelloOpen(false); }
    catch (error) { toast.show(error instanceof Error ? error.message : t("hello.unavailable"), "error"); }
    finally { setHelloBusy(false); }
  };

  // "You matched on Sunday" chip — derived from createdAt.
  const matchedAtChip = (() => {
    const d = new Date(conversation.createdAt);
    const opts: Intl.DateTimeFormatOptions = { weekday: "long" };
    const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 7) return `You matched on ${d.toLocaleDateString([], opts)}`;
    return `You matched ${d.toLocaleDateString()}`;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton onPress={goBack} size={44} accessibilityLabel="Back">
            <Icon name="arrowLeft" size={22} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isDuo ? "View Duo chat members" : `View ${partner.displayName}'s profile`}
            onPress={() =>
              isDuo ? setMembersOpen(true) : router.push({
                pathname: "/(app)/profile/[userId]",
                params: {
                  userId: partner.userId,
                  profileMode: "MATCH",
                  conversationId: conversation.id,
                },
              })
            }
            style={({ pressed }) => [
              styles.headerIdentity,
              pressed ? styles.headerIdentityPressed : null,
            ]}
          >
            <Avatar size={34} uri={isDuo ? undefined : partnerPhoto} initials={chatName} />
            <View style={styles.headerIdentityCopy}>
              <Text variant="bodyStrong" style={{ fontSize: 15 }} numberOfLines={1}>
                {chatName}
              </Text>
              {partnerTyping ? (
                <Text variant="caption" color="textBrand" style={{ fontSize: 11 }}>
                  Typing…
                </Text>
              ) : isDuo || partnerPresence ? (
                <View style={styles.statusRow}>
                  {partnerPresence === "ONLINE" ? <View style={styles.activeDot} /> : null}
                  <Text
                    variant="caption"
                    color={partnerPresence === "ONLINE" ? "success" : "textSubdued"}
                    style={{ fontSize: 11 }}
                  >
                    {isDuo ? `${members.length} people` : partnerPresence === "ONLINE" ? "Online" : "Offline"}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            {!isDuo ? <>
            {!blindActive ? <IconButton
              size={36}
              tone="soft"
              onPress={() => startCall("VIDEO")}
              accessibilityLabel={callAccessibilityLabel("VIDEO", allowsVideo)}
            >
              <Icon name="video" filled size={19} color={palette.brandStrong} />
            </IconButton> : null}
            <IconButton
              size={36}
              tone="soft"
              onPress={() => startCall("VOICE")}
              accessibilityLabel={callAccessibilityLabel("VOICE", allowsVoice)}
            >
              <Icon name="phone" filled size={18} color={palette.brandStrong} />
            </IconButton>
            </> : null}
            <IconButton
              size={40}
              accessibilityLabel="Conversation options"
              onPress={() => setMenuOpen(true)}
            >
              <Icon name="more" size={20} />
            </IconButton>
          </View>
        </View>

        {conversation.matchId ? <BlindConversationBanner key={conversation.matchId} matchId={conversation.matchId} onPolicy={setBlindActive} onRevealed={() => { void conversationsApi.get(conversationId).then(setConversation).catch(() => undefined); }} /> : null}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          {!isEmpty ? (
            <View pointerEvents="none" style={styles.threadPetal}>
              <Image
                accessible={false}
                source={petalArtwork}
                resizeMode="contain"
                style={[styles.threadPetalImage, { opacity: resolved === "dark" ? 0.07 : 0.12 }]}
              />
            </View>
          ) : null}
          {isEmpty ? (
            <ChatEmptyBody
              isDuo={isDuo}
              partnerName={chatName}
              onSelectOpener={onTextChange}
              onPlanDate={openDatePlanner}
              onSayHello={!isDuo && helloEnabled && allowsVoice ? () => setHelloOpen(true) : undefined}
            />
          ) : (
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 4 }}
            >
              <View style={styles.matchedChip}>
                <Text variant="caption" style={{ color: palette.textBrand, fontSize: 11 }}>
                  {matchedAtChip}
                </Text>
              </View>
              {sortedMessages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  accessToken={tokens?.accessToken}
                  senderName={isDuo ? members.find((member) => member.userId === m.senderId)?.displayName : undefined}
                  readLabel={isDuo && seenCount > 0 && m.senderId === user?.id && m.sequence === lastMineSeq ? `Seen by ${seenCount}` : undefined}
                  isMine={m.senderId === user?.id}
                  deliveryState={
                    failedMessageIds.has(m.clientMessageId ?? m.id)
                      ? "failed"
                      : m.status === "PENDING_MODERATION" && m.id === m.clientMessageId
                        ? "sending"
                        : undefined
                  }
                  onRetry={() => void deliverMessage(m, false)}
                  showRead={
                    !isDuo && m.senderId === user?.id &&
                    m.sequence === lastMineSeq &&
                    partnerLastReadSeq >= m.sequence
                  }
                />
              ))}
              {partnerTyping ? <TypingIndicator /> : null}
            </ScrollView>
          )}

          {closed ? (
            <View style={styles.closed}>
              <Text variant="caption" color="textSubdued" align="center">
                This conversation is closed
                {conversation.closedReason
                  ? ` · ${conversation.closedReason.toLowerCase().replaceAll("_", " ")}`
                  : ""}
              </Text>
            </View>
          ) : (
            <View style={styles.composer}>
              <IconButton
                onPress={onAttach}
                size={44}
                accessibilityLabel="Attach"
                disabled={attaching}
              >
                {attaching ? (
                  <ActivityIndicator size="small" color={palette.textBrand} />
                ) : (
                  <Icon name="plus" size={20} color={palette.textSubdued} />
                )}
              </IconButton>
              <View style={styles.composerMain}>
                <View style={styles.composerInput}>
                  <TextInput
                    accessibilityLabel={`Message ${chatName}`}
                    style={styles.input}
                    placeholder={`Message ${chatName}…`}
                    placeholderTextColor={palette.textPlaceholder}
                    value={text}
                    onChangeText={onTextChange}
                    onKeyPress={onComposerKeyPress}
                    multiline
                    maxLength={MESSAGE_MAX_LENGTH}
                    returnKeyType={Platform.OS === "web" ? "send" : "default"}
                    blurOnSubmit={false}
                  />
                  <Icon name="spark" size={18} color={palette.textSubdued} />
                </View>
                {text.length >= MESSAGE_COUNTER_THRESHOLD ? (
                  <Text
                    variant="micro"
                    color={text.length >= MESSAGE_MAX_LENGTH ? "warning" : "textSubdued"}
                    align="right"
                    accessibilityLiveRegion="polite"
                    style={styles.counter}
                  >
                    {text.length.toLocaleString()} / {MESSAGE_MAX_LENGTH.toLocaleString()}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !composerCanSend, busy: sending }}
                onPress={() => void onSend()}
                disabled={!composerCanSend}
                focusable
                style={({ pressed }) => [
                  styles.sendBtn,
                  composerCanSend ? null : styles.sendBtnDisabled,
                  pressed && composerCanSend ? styles.sendBtnPressed : null,
                ]}
              >
                <View pointerEvents="none" style={styles.sendIcon}>
                  {sending ? (
                    <ActivityIndicator size="small" color={palette.textOnBrand} />
                  ) : (
                    <Icon
                      name="send"
                      size={19}
                      strokeWidth={2.1}
                      color={composerCanSend ? palette.textOnBrand : palette.textMuted}
                    />
                  )}
                </View>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <CenterDialog
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        accessibilityLabel="Conversation options"
        style={styles.optionsDialog}
      >
        <View style={styles.dialogHeader}>
          <View style={styles.dialogTitle}>
            <Text variant="subheading">Conversation options</Text>
          </View>
          <IconButton
            size={36}
            tone="neutral"
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Close conversation options"
          >
            <Icon name="x" size={18} />
          </IconButton>
        </View>
        <View>
          {isDuo ? <>
            <ConversationOption icon="calendar" label="Duo meetup" accent onPress={() => { setMenuOpen(false); openDatePlanner(); }} />
            <View style={styles.optionDivider} />
            <ConversationOption icon="shield" label="Members & safety" onPress={() => { setMenuOpen(false); setMembersOpen(true); }} />
          </> : <>
            {helloEnabled && allowsVoice ? <ConversationOption icon="phone" label={t("hello.action")} onPress={() => { setMenuOpen(false); setHelloOpen(true); }} /> : null}
            {conversation.matchId ? <>
              <ConversationOption icon="calendar" label="Plan a meetup" accent onPress={() => { setMenuOpen(false); openDatePlanner(); }} />
              <ConversationOption icon="heart" label="Match details" onPress={() => { setMenuOpen(false); router.push(`/(app)/match/${conversation.matchId}`); }} />
            </> : null}
            <View style={styles.optionDivider} />
            <ConversationOption icon="flag" label="Report conversation" onPress={() => {
              setMenuOpen(false);
              router.push({
                pathname: "/(app)/report",
                params: { targetType: "CONVERSATION", targetId: conversation.id, reportedUserId: partner.userId },
              });
            }} />
            <ConversationOption icon="block" label={`Block ${partner.displayName}`} danger onPress={() => {
              setMenuOpen(false);
              setSafetyMember(null);
              setBlockOpen(true);
            }} />
          </>}
        </View>
      </CenterDialog>
      <DuoMembersDialog
        visible={membersOpen}
        members={members}
        currentUserId={user?.id}
        onClose={() => setMembersOpen(false)}
        onReport={(member) => {
          setMembersOpen(false);
          router.push({ pathname: "/(app)/report", params: { targetType: "CONVERSATION", targetId: conversation.id, reportedUserId: member.userId } });
        }}
        onBlock={(member) => { setSafetyMember(member); setMembersOpen(false); setBlockOpen(true); }}
      />
      <BlockConfirmModal
        visible={blockOpen}
        displayName={blockTarget.displayName}
        busy={blocking}
        onCancel={() => setBlockOpen(false)}
        onConfirm={() => void onBlockPartner()}
      />
      <CenterDialog visible={helloOpen} style={styles.compactDialog} onClose={() => !helloBusy && setHelloOpen(false)} accessibilityLabel={t("hello.action")}>
        <Text variant="subheading">{t("hello.invite", { name: partner.displayName })}</Text>
        <Text variant="body" color="textSubdued">{t("hello.consent")}</Text>
        <ButtonRow>
          <Button label={t("common.cancel")} variant="secondary" fullWidth disabled={helloBusy} onPress={() => setHelloOpen(false)} />
          <Button label={t("hello.call")} fullWidth loading={helloBusy} onPress={() => void sayHello()} />
        </ButtonRow>
      </CenterDialog>
      <CenterDialog visible={helloReturn && !isDuo} style={styles.compactDialog} onClose={() => setHelloReturn(false)} accessibilityLabel={t("hello.after")}>
        <Text variant="subheading">{t("hello.after")}</Text>
        <ButtonRow>
          <Button label={t("hello.chat")} variant="secondary" fullWidth onPress={() => setHelloReturn(false)} />
          <Button label={t("hello.meet")} fullWidth onPress={() => { setHelloReturn(false); openDatePlanner(); }} />
        </ButtonRow>
      </CenterDialog>
    </View>
  );
};

// Inline empty state used when the conversation has no messages yet.
const ChatEmptyBody: React.FC<{
  isDuo?: boolean;
  partnerName: string;
  onSelectOpener: (opener: string) => void;
  onPlanDate: () => void;
  onSayHello?: () => void;
}> = ({ isDuo, partnerName, onSelectOpener, onPlanDate, onSayHello }) => {
  const { t } = useLocalization();
  const { palette } = useTheme();
  const styles = useStyles();
  const breakers = [
    "What’s been a small good moment this week?",
    "Recommend me one thing — book, walk, anything.",
    "What’s on your Saturday list?",
  ];
  if (isDuo) return (
    <View style={{ flex: 1, padding: spacing.xxl, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
      <Text variant="subheading">Everyone’s here</Text>
      <Text variant="caption" color="textSubdued" align="center">Say hi or suggest a place for all four.</Text>
      <Button label="Suggest a meetup" variant="secondary" size="sm" onPress={onPlanDate} />
    </View>
  );
  return (
    <View style={{ flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 18 }}>
      <View style={[styles.heartCircle, shadows.glow]}>
        <Icon name="heartFill" size={36} color={palette.textOnBrand} />
      </View>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Text variant="titleSm" align="center">
          You matched with {partnerName}.
        </Text>
        <Text variant="caption" color="textSubdued" align="center">
          Say something kind.
        </Text>
      </View>
      <View style={{ width: "100%", gap: 8 }}>
        {onSayHello ? <Button label={t("hello.action")} size="sm" variant="secondary" onPress={onSayHello} /> : null}
        {breakers.map((b, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Use opener: ${b}`}
            onPress={() => onSelectOpener(b)}
            style={({ pressed }) => [styles.breakerCard, pressed ? { opacity: 0.72 } : null]}
          >
            <Text
              variant="caption"
              style={{ color: palette.textBrand, fontSize: 13, lineHeight: 19 }}
            >
              “{b}”
            </Text>
          </Pressable>
        ))}
      </View>
      <Button
        label="Plan a meetup"
        variant="secondary"
        fullWidth
        leftIcon={<Icon name="calendar" size={18} color={palette.brandStrong} />}
        onPress={onPlanDate}
      />
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomColor: palette.divider,
    borderBottomWidth: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIdentityPressed: { opacity: 0.68 },
  headerIdentityCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  optionsDialog: { padding: spacing.md },
  compactDialog: { gap: spacing.md, padding: spacing.md },
  dialogTitle: { flex: 1, minWidth: 0 },
  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  optionRowAccent: {
    backgroundColor: palette.brandSubdued,
  },
  optionRowPressed: { backgroundColor: palette.surfaceTint },
  optionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceTint,
  },
  optionIconAccent: { backgroundColor: palette.brandTint },
  optionIconDanger: { backgroundColor: palette.errorSubdued },
  optionLabel: { flex: 1 },
  optionDivider: {
    height: 1,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: palette.divider,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.success,
  },
  matchedChip: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 99,
    backgroundColor: palette.brandSubdued,
    marginBottom: 6,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: CHAT_COMPOSER_GAP,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopColor: palette.divider,
    borderTopWidth: 1,
    backgroundColor: palette.background,
  },
  composerMain: {
    flex: 1,
    minWidth: 0,
  },
  composerInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: {
    fontFamily: fontFamilies.regular,
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendBtn: {
    width: CHAT_TOUCH_TARGET,
    height: CHAT_TOUCH_TARGET,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.brandBorder,
    backgroundColor: palette.brandStrong,
  },
  threadPetal: {
    position: "absolute",
    right: -18,
    top: 92,
    width: 116,
    height: 116,
  },
  threadPetalImage: { width: "100%", height: "100%" },
  sendBtnDisabled: {
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceSubdued,
  },
  sendBtnPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  sendIcon: {
    zIndex: 2,
    elevation: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    marginTop: 3,
    paddingHorizontal: 8,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.brandSubdued,
  },
  errorActions: {
    width: "100%",
    maxWidth: 360,
    gap: 10,
    marginTop: 8,
  },
  closed: {
    padding: 14,
    backgroundColor: palette.surfaceTint,
    borderTopColor: palette.divider,
    borderTopWidth: 1,
  },
  heartCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: palette.brandStrong,
  },
  breakerCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: palette.brandSubdued,
    borderWidth: 1,
    borderColor: palette.brandBorder,
  },
}));
