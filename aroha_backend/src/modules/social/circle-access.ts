import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import type { ConversationStatus, Prisma } from "../../generated/prisma/client";
import { acceptsIntent, CIRCLES_FLAG, hasRosterBlock, isEligible, isPublic, nearby, rosterAcceptsIntent, socialEnabledFor, socialUser, type SocialUser } from "./social-access";

export const circleInclude = {
  organizer: { select: socialUser },
  memberships: { where: { status: "APPROVED" }, include: { user: { select: socialUser } } },
} satisfies Prisma.CircleInclude;

export const confirmedAttendees = {
  where: { need: 0, status: "APPROVED" }, include: { user: { select: socialUser } },
} satisfies NonNullable<Prisma.CircleActivityInclude["responses"]>;

export type Circle = Prisma.CircleGetPayload<{ include: typeof circleInclude }>;
type ActivityRoster = { responses: { user: SocialUser; userId: string }[] };

export function circleState(circle: Pick<Circle, "status" | "expiresAt">) {
  return circle.status !== "OPEN" ? circle.status : circle.expiresAt <= new Date() ? "EXPIRED" : "OPEN";
}

export function activityState(circle: Circle, activity: { cancelledAt: Date | null; expiresAt: Date }) {
  if (activity.cancelledAt) return "CANCELLED";
  const state = circleState(circle);
  return state !== "OPEN" ? state : activity.expiresAt <= new Date() ? "EXPIRED" : "OPEN";
}

export function circleEligible(circle: Circle, user: SocialUser, member: boolean) {
  const roster = circle.memberships.map(({ user: person }) => person);
  if (!isEligible(user)) return false;
  if (member) return rosterAcceptsIntent(roster, circle.intent);
  return isPublic(circle.organizer.profile) && nearby(user, circle.organizer) && roster.every((peer) =>
    isEligible(peer) && acceptsIntent(user, peer, circle.intent) && acceptsIntent(peer, user, circle.intent));
}

export function attendanceEligible(circle: Circle, activity: ActivityRoster, user: SocialUser) {
  const people = [...new Map([user, ...circle.memberships.map((row) => row.user),
    ...activity.responses.map((row) => row.user)].map((person) => [person.id, person])).values()];
  return rosterAcceptsIntent(people, circle.intent);
}

export async function circleChatRosterAllowed(db: PrismaTransactionalClient, ids: string[], intent: string) {
  if (await hasRosterBlock(db, ids)) return false;
  const people = await db.user.findMany({ where: { id: { in: ids } }, select: socialUser });
  return people.length === ids.length && rosterAcceptsIntent(people, intent);
}

export async function canReadActiveCircleChat(db: PrismaTransactionalClient, chat: {
  status: ConversationStatus;
  circle: Pick<Circle, "id" | "organizerId" | "status" | "expiresAt" | "intent">;
  members: { userId: string }[];
}, userId: string) {
  const { circle } = chat;
  const ids = chat.members.map((member) => member.userId);
  if (chat.status !== "ACTIVE" || circleState(circle) !== "OPEN" || !ids.includes(userId) ||
      !ids.includes(circle.organizerId) || !await socialEnabledFor(db, CIRCLES_FLAG, [userId])) return false;
  const current = await db.circleMembership.findMany({ where: { circleId: circle.id, status: "APPROVED" }, select: { userId: true } });
  return current.length === ids.length && current.every((member) => ids.includes(member.userId)) &&
    await circleChatRosterAllowed(db, ids, circle.intent);
}
