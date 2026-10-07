import type { Match, User, WingmanPairMatch, WingmanParty } from "../../../generated/prisma/client";

type Participant = Pick<User, "id" | "status" | "deletedAt" | "isChatFrozen">;
export interface ConversationContext {
  match: (Pick<Match, "status" | "userLowId" | "userHighId"> & {
    userLow: Participant;
    userHigh: Participant;
  }) | null;
  members?: { userId: string; user: Participant }[];
  duoMatch?: (Pick<WingmanPairMatch, "status" | "partyLowMembershipVersion" | "partyHighMembershipVersion"> & {
    partyLow: Pick<WingmanParty, "status" | "membershipVersion">;
    partyHigh: Pick<WingmanParty, "status" | "membershipVersion">;
  }) | null;
}

export function conversationUsers(context: ConversationContext): Participant[] {
  return context.match ? [context.match.userLow, context.match.userHigh] :
    (context.members ?? []).map((member) => member.user);
}

export function conversationParticipantIds(context: ConversationContext | null): string[] {
  if (!context) return [];
  return context.match
    ? [context.match.userLowId, context.match.userHighId]
    : (context.members ?? []).map((member) => member.userId);
}

export function relationshipIsActive(context: ConversationContext): boolean {
  if (context.match) return context.match.status === "ACTIVE";
  const duo = context.duoMatch;
  return Boolean(duo && duo.status === "ACTIVE" && context.members?.length === 4 &&
    duo.partyLow.status === "ACTIVE" && duo.partyHigh.status === "ACTIVE" &&
    duo.partyLow.membershipVersion === duo.partyLowMembershipVersion &&
    duo.partyHigh.membershipVersion === duo.partyHighMembershipVersion);
}
