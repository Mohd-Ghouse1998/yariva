import type { CallSessionDto } from "./call";
import type { MessageDto } from "./conversation";
import type { MatchSummaryDto } from "./match";
import type { NotificationDto } from "./notifications";
import type { PublicProfileDto } from "./profile";

export interface WsHandshakeAuthDto {
  accessToken: string;
  sessionId: string;
  lastEventId?: string | null;
}

export interface WsReadyDto {
  connectionId: string;
  userId: string;
  serverTime: string;
  sessionId: string;
}

export interface WsSystemErrorDto {
  code: string;
  message: string;
  requestId?: string;
}

export interface WsAckSuccessDto {
  ok: true;
  requestId: string;
  serverTime: string;
}

export interface WsAckErrorDto {
  ok: false;
  requestId: string;
  error: {
    code: string;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
}

export type WsAckPayload = WsAckSuccessDto | WsAckErrorDto;

export interface PresenceHeartbeatDto {
  status: "ONLINE";
  requestId: string;
}

export interface ConversationTypingEventDto {
  conversationId: string;
  requestId: string;
}

export interface PresenceUpdatedEventDto {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  updatedAt: string;
}

export interface ConversationTypingUpdatedEventDto {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  expiresAt: string;
}

export interface ConversationReadUpdatedEventDto {
  conversationId: string;
  readState: {
    userId: string;
    lastReadSequence: number;
    lastReadMessageId: string | null;
    lastReadAt: string;
  };
}

export interface MatchCreatedEventDto {
  match: MatchSummaryDto;
}

export interface MessageCreatedEventDto {
  message: MessageDto;
  conversationId: string;
}

export interface MessageUpdatedEventDto {
  message: MessageDto;
}

export interface MessageDeletedEventDto {
  conversationId: string;
  messageId: string;
}

export interface NotificationCreatedEventDto {
  notification: NotificationDto;
}

export interface CallRingingEventDto {
  call: CallSessionDto;
  otherUser: PublicProfileDto;
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
}

export interface CallAcceptedEventDto {
  call: CallSessionDto;
}

export interface CallAcceptedElsewhereEventDto {
  callId: string;
  acceptedBySessionId: string;
  occurredAt: string;
}

export interface CallConnectedEventDto {
  call: CallSessionDto;
}

export interface CallMissedEventDto {
  call: CallSessionDto;
}

export interface CallEndedEventDto {
  call: CallSessionDto;
}

// WebRTC signaling payloads
export interface CallOfferWsDto {
  callId: string;
  sdp: string;
  signalingVersion: number;
  requestId?: string;
}

export interface CallAnswerWsDto {
  callId: string;
  sdp: string;
  signalingVersion: number;
  requestId?: string;
}

export interface CallIceWsDto {
  callId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number;
    usernameFragment?: string | null;
  };
  signalingVersion: number;
  requestId: string;
}

export interface CallRingAckWsDto {
  callId: string;
  requestId?: string;
}

// All server -> client event names (typed)
export type ServerEvent =
  | "system.ready"
  | "system.error"
  | "presence.updated"
  | "match.created"
  | "conversation.message.created"
  | "conversation.message.updated"
  | "conversation.message.deleted"
  | "conversation.read.updated"
  | "conversation.closed"
  | "duo.plan.updated"
  | "conversation.typing.updated"
  | "notification.created"
  | "call.ringing"
  | "call.accepted"
  | "call.acceptedElsewhere"
  | "call.connected"
  | "call.missed"
  | "call.ended"
  | "call.offer"
  | "call.answer"
  | "call.ice";

export type ClientEvent =
  | "presence.heartbeat"
  | "conversation.typing.start"
  | "conversation.typing.stop"
  | "call.ring.ack"
  | "call.offer"
  | "call.answer"
  | "call.ice";
