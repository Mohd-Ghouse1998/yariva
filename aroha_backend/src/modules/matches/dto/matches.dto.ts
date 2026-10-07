import { Transform } from "class-transformer";
import { IsBoolean } from "class-validator";
import type { PublicProfileDto } from "../../discovery/dto/discovery.dto";

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
  status: "ACTIVE" | "ENDED";
  matchedAt: string;
  endedAt: string | null;
  endedReason: "UNMATCHED" | "BLOCKED" | "MODERATION" | "ACCOUNT_DELETED" | null;
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

export interface MatchDetailResponseDto {
  match: MatchDetailDto;
}

export interface EndMatchResponseDto {
  match: MatchSummaryDto;
}

export class UpdateMyMatchCommunicationSettingDto {
  @Transform(({ value }) => Boolean(value))
  @IsBoolean()
  readonly allowVoiceCalls!: boolean;

  @Transform(({ value }) => Boolean(value))
  @IsBoolean()
  readonly allowVideoCalls!: boolean;

  @Transform(({ value }) => Boolean(value))
  @IsBoolean()
  readonly muted!: boolean;
}

export interface UpdateMyMatchCommunicationSettingResponseDto {
  setting: MatchCommunicationSettingDto;
}
