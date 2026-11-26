import type { PrismaTransactionalClient } from "../../database/prisma/prisma.transaction";
import { activityState, attendanceEligible, canReadActiveCircleChat, circleEligible, circleInclude, circleState, confirmedAttendees } from "./circle-access";
import { activeCheckInMatch } from "./intent-consent";
import { CIRCLES_FLAG, hasRosterBlock, isPublic, socialEnabledFor, socialUser } from "./social-access";

export async function canReadSocialNotice(db: PrismaTransactionalClient, userId: string, data: Record<string, unknown>) {
  if (data.route === "circle-message") {
    if (typeof data.messageId !== "string" || typeof data.conversationId !== "string") return false;
    const message = await db.message.findFirst({
      where: { id: data.messageId, conversationId: data.conversationId, status: { in: ["ACTIVE", "PENDING_MODERATION"] } },
      select: { senderId: true, conversation: { select: { status: true, circle: true, members: { select: { userId: true } } } } },
    });
    const chat = message?.conversation;
    return !!message && !!chat?.circle && message.senderId !== userId &&
      await canReadActiveCircleChat(db, { ...chat, circle: chat.circle }, userId);
  }

  if (data.route === "connection-check-in") {
    if (typeof data.conversationId !== "string" || !await activeCheckInMatch(db, userId, data.conversationId)) return false;
    const row = await db.conversationCheckIn.findUnique({ where: { conversationId: data.conversationId } });
    if (!row) return false;
    if (data.kind === "intent-invite" || data.kind === "intent-update") return row.intentVersion === data.version;
    if (row.vibeVersion !== data.version) return false;
    return data.kind === "vibe-invite" ? !!row.vibeInviterId && row.vibeInviterId !== userId && !row.vibeAccepted :
      data.kind === "vibe-complete" && row.lowAnswers.length > 0 && row.highAnswers.length > 0;
  }

  if (typeof data.circleId !== "string") return false;
  const circle = await db.circle.findUnique({ where: { id: data.circleId }, include: circleInclude });
  if (!circle || circleState(circle) !== "OPEN") return false;
  const update = data.route === "circle-activity" && (data.status === "UPDATED" || data.status === "CANCELLED");
  const applicantId = update ? userId : data.applicantId;
  const intendedRecipient = data.status === "PENDING" ? circle.organizerId : applicantId;
  if (typeof applicantId !== "string" || userId !== intendedRecipient || applicantId === circle.organizerId ||
      !await socialEnabledFor(db, CIRCLES_FLAG, [circle.organizerId, applicantId])) return false;
  const member = circle.memberships.some((row) => row.userId === applicantId);
  const applicant = await db.user.findUnique({ where: { id: applicantId }, select: socialUser });
  if (!applicant || !circleEligible(circle, applicant, member)) return false;
  const ids = [...new Set([applicantId, circle.organizerId, ...circle.memberships.map((row) => row.userId)])];

  if (data.route === "circle-membership") {
    const membership = await db.circleMembership.findUnique({ where: { circleId_userId: { circleId: circle.id, userId: applicantId } } });
    return typeof data.requestId === "string" && membership?.requestId === data.requestId && membership.status === data.status &&
      (membership.status !== "PENDING" || isPublic(applicant.profile)) && !await hasRosterBlock(db, ids);
  }

  if (data.route !== "circle-activity" || typeof data.activityId !== "string") return false;
  const activity = await db.circleActivity.findFirst({
    where: { id: data.activityId, circleId: circle.id }, include: { responses: confirmedAttendees },
  });
  if (!activity || (!member && !activity.openToNearby) || !attendanceEligible(circle, activity, applicant) ||
      await hasRosterBlock(db, [...new Set([...ids, ...activity.responses.map((row) => row.userId)])])) return false;
  if (update) {
    if (activity.version !== data.version || activityState(circle, activity) !== (data.status === "CANCELLED" ? "CANCELLED" : "OPEN")) return false;
    return !!await db.circleActivityResponse.findFirst({ where: {
      activityId: activity.id, userId: applicantId, status: { in: ["PENDING", "APPROVED"] },
      need: member ? { lte: activity.helpNeeds.length } : 0,
    }, select: { userId: true } });
  }

  const need = data.need;
  if (activityState(circle, activity) !== "OPEN" || typeof need !== "number" || !Number.isInteger(need) ||
      need < 0 || need > activity.helpNeeds.length || (!member && need !== 0) || typeof data.requestId !== "string") return false;
  const response = await db.circleActivityResponse.findUnique({
    where: { activityId_userId_need: { activityId: activity.id, userId: applicantId, need } },
  });
  return response?.requestId === data.requestId && response.status === data.status;
}
