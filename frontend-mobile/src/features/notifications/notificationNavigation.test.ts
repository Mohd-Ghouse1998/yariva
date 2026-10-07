import { describe, expect, it } from "vitest";
import { actorInitials, notificationDisplayCopy, resolveNotificationHref } from "./notificationNavigation";

describe("notification navigation", () => {
  it("normalizes historical Duo product copy but not user messages or routes", () => {
    const notification = { type: "SYSTEM" as const, data: { partyId: "wingman-party-1" }, title: "Wingman invite", body: "A friend invited you to create a wingman." };
    expect(notificationDisplayCopy(notification)).toEqual({ title: "Duo invite", body: "A friend invited you to create a Duo." });
    expect(resolveNotificationHref(notification)).toBe("/(app)/wingman");
    expect(notificationDisplayCopy({ ...notification, type: "NEW_MESSAGE" }).title).toBe("Wingman invite");
  });
  it("routes supported notification types from explicit identifiers", () => {
    expect(
      resolveNotificationHref({ type: "NEW_MESSAGE", data: { conversationId: "conversation-1" } }),
    ).toEqual({
      pathname: "/(app)/conversation/[conversationId]",
      params: { conversationId: "conversation-1" },
    });
    expect(resolveNotificationHref({ type: "NEW_LIKE", data: {} })).toBe(
      "/(app)/(tabs)/connections",
    );
    expect(resolveNotificationHref({ type: "SYSTEM", data: { partyId: "wingman-party-1" } })).toBe(
      "/(app)/wingman",
    );
  });

  it("does not navigate when a required route identifier is absent", () => {
    expect(resolveNotificationHref({ type: "SYSTEM", data: { route: "weekly-recap", recapId: "private-id" } })).toBe("/(app)/weekly-recap");
    expect(resolveNotificationHref({ type: "SYSTEM", data: { route: "https://foreign.invalid" } })).toBeNull();
    expect(resolveNotificationHref({ type: "NEW_MATCH", data: {} })).toBeNull();
    expect(resolveNotificationHref({ type: "SYSTEM", data: {} })).toBeNull();
  });

  it("derives initials only from stable actor identity", () => {
    expect(actorInitials("Asha Rao")).toBe("AR");
    expect(actorInitials(null)).toBe("·");
  });
});
