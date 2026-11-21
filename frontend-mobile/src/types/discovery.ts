import type { PublicProfileDto } from "./profile";
import type { ConversationSummaryDto } from "./conversation";
import type { MatchSummaryDto } from "./match";
import type { ConnectionIntent } from "./enums";

export interface CursorPageQuery {
  cursor?: string | null;
  limit?: number;
}

export interface DiscoveryFeedResponseDto {
  firstConnectionUserIds?: string[];
  items: PublicProfileDto[];
  nextCursor: string | null;
  snapshotExpiresAt: string;
  dailyLimit: number;
  remainingToday: number;
}

export interface CreateLikeRequest {
  targetUserId: string;
  introNote?: string;
  sceneId?: string;
}

export interface CreateLikeResponseDto {
  outcome: "LIKE_RECORDED" | "MATCH_CREATED";
  like: {
    id: string;
    actorId: string;
    targetId: string;
    introNote: string | null;
    status: "ACTIVE" | "MATCHED" | "RETRACTED";
    matchedAt: string | null;
    retractedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  match: MatchSummaryDto | null;
  conversation: ConversationSummaryDto | null;
}

export interface CreatePassRequest {
  targetUserId: string;
}

export interface PassDto {
  id: string;
  actorId: string;
  targetId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ReceivedLikeIntent = Extract<
  ConnectionIntent,
  "FRIENDSHIP" | "COMPANIONSHIP" | "SHARED_INTERESTS" | "RELATIONSHIP"
>;

// Row in the Likes tab — slim profile preview from GET /likes/received.
export interface ReceivedLikePreviewDto {
  likeId: string;
  actorUserId: string;
  likedAt: string;
  introNote: string | null;
  displayName: string;
  age: number | null;
  headline: string | null;
  intents: ReceivedLikeIntent[];
  primaryPhotoUrl: string | null;
  city: string | null;
  region: string | null;
}

export interface ReceivedLikesResponseDto {
  items: ReceivedLikePreviewDto[];
  nextCursor: string | null;
}
