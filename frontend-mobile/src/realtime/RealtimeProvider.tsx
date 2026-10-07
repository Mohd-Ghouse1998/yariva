import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import type {
  CallSessionDto,
} from "../types/call";
import type { MessageDto } from "../types/conversation";
import type { MatchSummaryDto } from "../types/match";
import type { NotificationDto } from "../types/notifications";
import type {
  CallAcceptedElsewhereEventDto,
  CallRingingEventDto,
  ConversationReadUpdatedEventDto,
  ConversationTypingUpdatedEventDto,
  PresenceUpdatedEventDto,
} from "../types/realtime";
import { socketClient, type SocketStatus } from "./socket";

type Listener<T> = (payload: T) => void;

interface RealtimeContextValue {
  status: SocketStatus;
  onMatchCreated(cb: Listener<{ match: MatchSummaryDto }>): () => void;
  onMessageCreated(cb: Listener<{ message: MessageDto; conversationId: string }>): () => void;
  onMessageUpdated(cb: Listener<{ message: MessageDto }>): () => void;
  onMessageDeleted(cb: Listener<{ conversationId: string; messageId: string }>): () => void;
  onConversationRead(cb: Listener<ConversationReadUpdatedEventDto>): () => void;
  onConversationClosed(cb: Listener<{ conversationId: string }>): () => void;
  onTyping(cb: Listener<ConversationTypingUpdatedEventDto>): () => void;
  onPresence(cb: Listener<PresenceUpdatedEventDto>): () => void;
  onNotification(cb: Listener<{ notification: NotificationDto }>): () => void;
  onCallRinging(cb: Listener<CallRingingEventDto>): () => void;
  onCallAccepted(cb: Listener<{ call: CallSessionDto }>): () => void;
  onCallAcceptedElsewhere(cb: Listener<CallAcceptedElsewhereEventDto>): () => void;
  onCallConnected(cb: Listener<{ call: CallSessionDto }>): () => void;
  onCallMissed(cb: Listener<{ call: CallSessionDto }>): () => void;
  onCallEnded(cb: Listener<{ call: CallSessionDto }>): () => void;
  emit: typeof socketClient.emit;
  socket: typeof socketClient;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const useRealtime = (): RealtimeContextValue => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
};

const HEARTBEAT_MS = 25_000;

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tokens, status: authStatus } = useAuth();
  const [status, setStatus] = useState<SocketStatus>("idle");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsub = socketClient.onStatusChange(setStatus);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || !tokens) {
      socketClient.disconnect();
      return;
    }
    socketClient.connect({
      accessToken: tokens.accessToken,
      sessionId: tokens.sessionId,
    });

    heartbeatRef.current = setInterval(() => {
      socketClient.emit("presence.heartbeat", { status: "ONLINE" });
    }, HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socketClient.disconnect();
    };
  }, [authStatus, tokens]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      onMatchCreated: (cb) => socketClient.on("match.created", cb),
      onMessageCreated: (cb) => socketClient.on("conversation.message.created", cb),
      onMessageUpdated: (cb) => socketClient.on("conversation.message.updated", cb),
      onMessageDeleted: (cb) => socketClient.on("conversation.message.deleted", cb),
      onConversationRead: (cb) => socketClient.on("conversation.read.updated", cb),
      onConversationClosed: (cb) => socketClient.on("conversation.closed", cb),
      onTyping: (cb) => socketClient.on("conversation.typing.updated", cb),
      onPresence: (cb) => socketClient.on("presence.updated", cb),
      onNotification: (cb) => socketClient.on("notification.created", cb),
      onCallRinging: (cb) => socketClient.on("call.ringing", cb),
      onCallAccepted: (cb) => socketClient.on("call.accepted", cb),
      onCallAcceptedElsewhere: (cb) => socketClient.on("call.acceptedElsewhere", cb),
      onCallConnected: (cb) => socketClient.on("call.connected", cb),
      onCallMissed: (cb) => socketClient.on("call.missed", cb),
      onCallEnded: (cb) => socketClient.on("call.ended", cb),
      emit: socketClient.emit.bind(socketClient),
      socket: socketClient,
    }),
    [status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
