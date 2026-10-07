import type { MatchEndReason, MatchStatus } from "./enums";
import type { PublicProfileDto } from "./profile";

export interface MatchCommunicationSettingDto {
  matchId: string;
  userId: string;
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  muted: boolean;
  updatedAt: string;
}

export interface MatchSummaryDto {
  id: string;
  status: MatchStatus;
  matchedAt: string;
  endedAt: string | null;
  endedReason: MatchEndReason | null;
  otherUser: PublicProfileDto;
  conversationId: string | null;
  myCommunicationSetting: MatchCommunicationSettingDto;
  lastMessagePreview: string | null;
  lastMessageSentAt: string | null;
}

export interface MatchDetailDto extends MatchSummaryDto {
  otherUserCommunicationAllowed: {
    allowVoiceCalls: boolean;
    allowVideoCalls: boolean;
  };
}

export interface MatchPageDto {
  items: MatchSummaryDto[];
  nextCursor: string | null;
}

export interface UpdateMyMatchCommunicationSettingRequest {
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  muted: boolean;
}

export interface UpdateMyMatchCommunicationSettingResponse {
  setting: MatchCommunicationSettingDto;
}

export interface EndMatchResponse {
  match: MatchSummaryDto;
}
