import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import type { ConversationCheckIn } from "../../generated/prisma/client";
import { acceptsIntent, CHECK_IN_FLAG, hasRosterBlock, isEligible, socialEnabledFor, socialUser, type SocialUser } from "./social-access";

export const checkInParticipants = {
  userLow: { select: socialUser },
  userHigh: { select: socialUser },
};

export async function activeCheckInMatch(db: PrismaTransactionalClient, userId: string, id: string) {
  const conversation = await db.conversation.findFirst({
    where: { id, status: "ACTIVE", match: { status: "ACTIVE", OR: [{ userLowId: userId }, { userHighId: userId }] } },
    include: { match: { include: checkInParticipants } },
  });
  const match = conversation?.match;
  if (!match || !isEligible(match.userLow) || !isEligible(match.userHigh)) return null;
  const ids = [match.userLowId, match.userHighId];
  if (!await socialEnabledFor(db, CHECK_IN_FLAG, ids) || await hasRosterBlock(db, ids) ||
      await db.blindRelationship.findFirst({ where: { matchId: match.id, revealedAt: null }, select: { matchId: true } })) return null;
  return match;
}

export async function clearInvalidAgreement(
  tx: PrismaTransactionalClient, row: ConversationCheckIn | null, pair: { userLow: SocialUser; userHigh: SocialUser },
) {
  if (!row?.lowIntent || row.lowIntent !== row.highIntent) return row;
  const { userLow, userHigh } = pair;
  if (isEligible(userLow) && isEligible(userHigh) &&
      acceptsIntent(userLow, userHigh, row.lowIntent) && acceptsIntent(userHigh, userLow, row.lowIntent)) return row;
  return tx.conversationCheckIn.update({
    where: { conversationId: row.conversationId },
    data: { lowIntent: null, highIntent: null, intentVersion: { increment: 1 } },
  });
}

// Lock the same rows as check-in writes before reading either participant's policy.
export async function refreshIntentAgreements(tx: PrismaTransactionalClient, userId: string) {
  const ids = await tx.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Conversation" c
    JOIN "Match" m ON c."matchId" = m.id
    WHERE c.status = 'ACTIVE' AND m.status = 'ACTIVE'
      AND (m."userLowId" = ${userId}::uuid OR m."userHighId" = ${userId}::uuid)
    ORDER BY c.id FOR UPDATE OF c
  `;
  if (!ids.length) return;
  const rows = await tx.conversationCheckIn.findMany({
    where: { conversationId: { in: ids.map(({ id }) => id) }, lowIntent: { not: null }, highIntent: { not: null } },
    include: { conversation: { select: { match: { select: checkInParticipants } } } },
  });
  for (const row of rows) {
    const pair = row.conversation.match;
    if (pair) await clearInvalidAgreement(tx, row, pair);
  }
}
