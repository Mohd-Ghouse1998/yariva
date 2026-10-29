import type { Href } from "expo-router";
import type { NotificationDto } from "../../types/notifications";

const DATE_NOTIFICATION_TYPES = new Set<NotificationDto["type"]>([
  "DATE_PROPOSED",
  "DATE_ACCEPTED",
  "DATE_CHANGED",
  "DATE_CANCELLED",
  "DATE_REMINDER",
  "SAFETY_CHECK_IN",
  "MUTUAL_MEET_AGAIN",
]);

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/** Legacy stored product notifications may predate the public Duo name.
 * Scope replacement to Duo system events; never rewrite user messages/routes. */
export const notificationDisplayCopy = (notification: Pick<NotificationDto, "type" | "data" | "title" | "body">) => {
  const duo = notification.type === "SYSTEM" &&
    Boolean(stringValue(notification.data?.partyId) || stringValue(notification.data?.pairMatchId));
  return {
    title: duo ? notification.title.replace(/\bwingman\b/gi, "Duo") : notification.title,
    body: duo ? notification.body.replace(/\bwingman\b/gi, "Duo") : notification.body,
  };
};

export const resolveNotificationHref = (
  notification: Pick<NotificationDto, "type" | "data">,
): Href | null => {
  const data = notification.data ?? {};
  if (notification.type === "SYSTEM" && data.route === "private-story") {
    const storyId = stringValue(data.storyId);
    return storyId ? { pathname: "/(app)/private-stories", params: { storyId } } : null;
  }
  if (notification.type === "SYSTEM" && data.route === "weekly-recap") return "/(app)/weekly-recap";
  const blindOccurrenceId = stringValue(data.blindOccurrenceId);
  if (notification.type === "SYSTEM" && blindOccurrenceId) return { pathname: "/(app)/blind/[occurrenceId]", params: { occurrenceId: blindOccurrenceId } };
  if (notification.type === "NEW_LIKE") return "/(app)/(tabs)/connections";

  if (notification.type === "NEW_MATCH" || notification.type === "MISSED_CALL") {
    const matchId = stringValue(data.matchId);
    return matchId ? { pathname: "/(app)/match/[matchId]", params: { matchId } } : null;
  }

  if (notification.type === "NEW_MESSAGE") {
    const conversationId = stringValue(data.conversationId);
    return conversationId
      ? {
          pathname: "/(app)/conversation/[conversationId]",
          params: { conversationId },
        }
      : null;
  }

  if (DATE_NOTIFICATION_TYPES.has(notification.type)) {
    const datePlanId = stringValue(data.datePlanId);
    return datePlanId
      ? {
          pathname: "/(app)/date-plan/[datePlanId]",
          params: { datePlanId },
        }
      : null;
  }

  if (notification.type === "SYSTEM" && stringValue(data.partyId)) {
    return "/(app)/wingman";
  }

  return null;
};

export const actorInitials = (displayName: string | null | undefined): string => {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return "·";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase();
};
