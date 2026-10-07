export type WingmanState = "NONE" | "PENDING" | "ACTIVE" | "DISCONNECTED";
export type WingmanInvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";

export interface WingmanPersonDto {
  userId: string;
  displayName: string;
}

export interface WingmanPartyDto {
  id: string;
  status: "PENDING" | "ACTIVE" | "DISCONNECTED";
  membershipVersion: number;
  role: "OWNER" | "BUDDY";
  buddy: WingmanPersonDto | null;
  invitation: {
    id: string;
    status: WingmanInvitationStatus;
    direction: "SENT" | "RECEIVED";
    expiresAt: string;
    inviter: WingmanPersonDto | null;
  } | null;
  sceneConsent: {
    current: boolean;
    sceneId: string | null;
    sceneVersion: number | null;
  };
  buddySceneConsented: boolean;
  bothSceneConsented: boolean;
  activatedAt: string | null;
  disconnectedAt: string | null;
}

export interface WingmanStateDto {
  state: WingmanState;
  party: WingmanPartyDto | null;
}

export interface WingmanCapabilitiesDto {
  enabled: boolean;
  invitationTtlHours: number;
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
