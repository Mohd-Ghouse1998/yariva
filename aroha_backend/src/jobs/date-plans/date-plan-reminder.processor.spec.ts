import { DatePlanReminderProcessor } from "./date-plan-reminder.processor";

describe("DatePlanReminderProcessor", () => {
  const plan = {
    id: "plan-1",
    matchId: "match-1",
    proposalVersion: 2,
    title: "Book browsing and chai",
    status: "ACCEPTED",
    match: { userLowId: "user-1", userHighId: "user-2" },
  };

  it("sends the private safety prompt to both participants", async () => {
    const notifications = { execute: jest.fn().mockResolvedValue({}) };
    const processor = new DatePlanReminderProcessor(
      { datePlan: { findUnique: jest.fn().mockResolvedValue(plan) } } as any,
      notifications as any,
      { warn: jest.fn() } as any,
    );

    await processor.process({
      data: { datePlanId: plan.id, kind: "SAFETY_CHECK_IN" },
    } as any);

    expect(notifications.execute).toHaveBeenCalledTimes(2);
    expect(notifications.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: "user-1", type: "SAFETY_CHECK_IN", title: "Are you okay?" }),
    );
    expect(notifications.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: "user-2", type: "SAFETY_CHECK_IN", title: "Are you okay?" }),
    );
  });

  it("suppresses stale delayed jobs after a plan is cancelled", async () => {
    const notifications = { execute: jest.fn() };
    const processor = new DatePlanReminderProcessor(
      { datePlan: { findUnique: jest.fn().mockResolvedValue({ ...plan, status: "CANCELLED" }) } } as any,
      notifications as any,
      { warn: jest.fn() } as any,
    );

    await processor.process({
      data: { datePlanId: plan.id, kind: "DATE_REMINDER" },
    } as any);

    expect(notifications.execute).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "CHANGED", "STALE"])("suppresses reminders for an event that is %s", async state => {
    const notifications = { execute: jest.fn() };
    const event = { status: state === "CANCELLED" ? "CANCELLED" : "PUBLISHED", version: state === "CHANGED" ? 2 : 1,
      verifiedAt: new Date(Date.now() - (state === "STALE" ? 8 : 0) * 86400000) };
    const processor = new DatePlanReminderProcessor(
      { datePlan: { findUnique: jest.fn().mockResolvedValue({ ...plan, eventVersion: 1, event }) } } as any,
      notifications as any, { warn: jest.fn() } as any,
    );
    await processor.process({ data: { datePlanId: plan.id, kind: "DATE_REMINDER" } } as any);
    expect(notifications.execute).not.toHaveBeenCalled();
  });

});
