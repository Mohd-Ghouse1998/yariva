import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class DuoDiscoveryQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class DuoVoteDto {
  @IsString()
  @IsIn(["APPROVE", "PASS"])
  decision!: "APPROVE" | "PASS";
}

export interface DuoDiscoveryMemberDto {
  userId: string;
  displayName: string;
  age: number;
  photoUrl: string | null;
  scene: {
    id: string;
    version: number;
    intent: "DATING" | "FRIENDSHIP" | "CASUAL_HANG";
    activity: string;
    photoUrl: string | null;
    expiresAt: string;
  };
}

export interface DuoCandidateDto {
  partyId: string;
  membershipVersion: number;
  members: DuoDiscoveryMemberDto[];
  distance: {
    roundedKm: number;
    band: "LOCAL" | "NEARBY" | "FARTHER";
  };
  ownApprovalCount: number;
  ownMemberCount: number;
}

export interface DuoPairMatchDto {
  id: string;
  conversationId: string | null;
  matchedAt: string;
  otherDuo: {
    partyId: string;
    members: DuoDiscoveryMemberDto[];
  };
}

export interface DuoDiscoveryPageDto {
  items: DuoCandidateDto[];
  nextCursor: string | null;
  waiting: {
    targetCount: number;
    state: "NONE" | "WAITING_FOR_YOUR_DUO" | "WAITING_FOR_OTHER_DUO";
  };
  match: DuoPairMatchDto | null;
}

export interface DuoVoteResponseDto {
  outcome: "VOTE_RECORDED" | "PAIR_MATCH_CREATED" | "PAIR_MATCH_EXISTS";
  decision: "APPROVE" | "PASS";
  ownApprovalCount: number;
  ownMemberCount: number;
  match: DuoPairMatchDto | null;
}
