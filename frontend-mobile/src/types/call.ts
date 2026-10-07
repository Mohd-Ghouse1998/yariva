import type { CallEndReason, CallSessionStatus, CallType } from "./enums";

export interface CallSessionDto {
  id: string;
  matchId: string;
  conversationId: string;
  initiatorUserId: string;
  receiverUserId: string;
  callType: CallType;
  purpose?: "STANDARD" | "VOICE_INTRODUCTION";
  introductionPrompt?: string | null;
  suggestedDurationSeconds?: number | null;
  status: CallSessionStatus;
  signalingVersion: number;
  ringStartedAt: string | null;
  acceptedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  expiresAt: string;
  endReason: CallEndReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateCallRequest {
  matchId: string;
  callType: CallType;
  purpose?: "STANDARD" | "VOICE_INTRODUCTION";
}

export interface InitiateCallResponse {
  call: CallSessionDto;
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
}

export interface AcceptCallResponse {
  call: CallSessionDto;
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
}

export interface CallResponse {
  call: CallSessionDto;
}

export interface EndCallRequest {
  reason: Extract<CallEndReason, "HANGUP">;
}
