type CircleMembershipNotice = {
  route: "circle-membership"; circleId: string; applicantId: string; requestId: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
};

type CircleActivityNotice = { route: "circle-activity"; circleId: string; activityId: string } & (
  { status: "PENDING" | "APPROVED" | "DECLINED" | "REMOVED"; applicantId: string; need: number; requestId: string } |
  { status: "UPDATED" | "CANCELLED"; version: number }
);

export type SocialNoticeData =
  | CircleMembershipNotice
  | CircleActivityNotice
  | { route: "circle-message"; conversationId: string; messageId: string }
  | { route: "connection-check-in"; conversationId: string; kind: "intent-invite" | "intent-update" | "vibe-invite" | "vibe-complete"; version: number };

export function isSocialNoticeRoute(route: unknown): route is SocialNoticeData["route"] {
  return route === "circle-message" || route === "circle-membership" ||
    route === "circle-activity" || route === "connection-check-in";
}

export function socialNoticeLink(data: Record<string, unknown>): Record<string, unknown> {
  const { route, circleId, activityId, conversationId } = data;
  if (route === "circle-membership") return { route, circleId };
  if (route === "circle-activity") return { route, circleId, activityId };
  return { route, conversationId };
}
