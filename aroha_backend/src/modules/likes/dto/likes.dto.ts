import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import type { ConversationSummaryDto } from "../../conversations/dto/conversations.dto";
import type { MatchSummaryDto } from "../../matches/dto/matches.dto";

export class CreateLikeDto {
  @IsUUID("4")
  @IsNotEmpty()
  readonly targetUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  readonly introNote?: string;
}

export interface LikeDto {
  id: string;
  actorId: string;
  targetId: string;
  introNote: string | null;
  status: "ACTIVE" | "MATCHED" | "RETRACTED";
  matchedAt: string | null;
  retractedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLikeResponseDto {
  outcome: "LIKE_RECORDED" | "MATCH_CREATED";
  like: LikeDto;
  match: MatchSummaryDto | null;
  conversation: ConversationSummaryDto | null;
}

export class CreatePassDto {
  @IsUUID("4")
  @IsNotEmpty()
  readonly targetUserId!: string;
}

export interface PassDto {
  id: string;
  actorId: string;
  targetId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// Surfaced on the Likes-tab list. Includes a slim profile preview (just enough
// for an avatar row) plus the original like timestamp and any intents/interests
// the actor advertised, so the UI can show "why" without a second round-trip.
export interface ReceivedLikePreviewDto {
  likeId: string;
  actorUserId: string;
  likedAt: string;
  introNote: string | null;
  displayName: string;
  age: number;
  headline: string | null;
  intents: Array<
    "FRIENDSHIP" | "COMPANIONSHIP" | "SHARED_INTERESTS" | "RELATIONSHIP"
  >;
  primaryPhotoUrl: string | null;
  city: string | null;
  region: string | null;
}

export interface ReceivedLikesResponseDto {
  items: ReceivedLikePreviewDto[];
  nextCursor: string | null;
}
