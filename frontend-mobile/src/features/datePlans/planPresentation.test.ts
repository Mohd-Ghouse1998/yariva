import { describe, expect, it } from "vitest";
import { canCancelPlan, canRespondToPlan, planStatusLabel, planView } from "./planPresentation";

describe("meetup presentation, not attendance", () => {
  const plan = {
    status: "ACCEPTED" as const,
    startAt: "2026-09-24T18:00:00+05:30",
    durationMinutes: 60,
  };
  it("moves elapsed accepted plans into Past without modifying their status", () => {
    expect(planView(plan, Date.parse("2026-09-29T12:00:00Z"))).toBe("PAST");
    expect(planStatusLabel(plan, Date.parse("2026-09-29T12:00:00Z"))).toBe("Past · Confirmed");
    expect(plan.status).toBe("ACCEPTED");
  });
  it("keeps an ongoing plan until its end, across timezone offsets", () => {
    expect(planView(plan, Date.parse("2026-09-24T13:29:59Z"))).toBe("UPCOMING");
    expect(planView(plan, Date.parse("2026-09-24T13:30:00Z"))).toBe("PAST");
  });
  it("handles expired proposals, terminal states and invalid dates honestly", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    expect(planView({ ...plan, status: "PROPOSED" }, now)).toBe("PAST");
    expect(planStatusLabel({ ...plan, status: "PROPOSED" }, now)).toBe("Past proposal");
    expect(planView({ ...plan, status: "CANCELLED", startAt: "2026-10-01T00:00:00Z" }, now)).toBe(
      "PAST",
    );
    expect(planView({ ...plan, startAt: "invalid" }, now)).toBe("UPCOMING");
  });
  it("uses only the scheduled start for Duo without inventing a duration", () => {
    const duo = { status: "ACCEPTED" as const, startAt: plan.startAt };
    expect(planView(duo, Date.parse(plan.startAt))).toBe("PAST");
    expect(planStatusLabel(duo, Date.parse(plan.startAt))).toBe("Past · Confirmed");
  });
  it("hides expired response and cancellation actions without altering the plan", () => {
    const beforeEnd = Date.parse("2026-09-24T13:29:59Z");
    const afterEnd = Date.parse("2026-09-24T13:30:00Z");
    expect(canCancelPlan(plan, beforeEnd)).toBe(true);
    expect(canCancelPlan(plan, afterEnd)).toBe(false);
    expect(canRespondToPlan({ ...plan, status: "PROPOSED" }, beforeEnd)).toBe(true);
    expect(canRespondToPlan({ ...plan, status: "COUNTERED" }, afterEnd)).toBe(false);
    expect(canCancelPlan({ ...plan, status: "CANCELLED" }, beforeEnd)).toBe(false);
    expect(plan.status).toBe("ACCEPTED");
  });
  it.each(["eventChanged", "eventUnavailable"] as const)(
    "does not present a future accepted plan as Confirmed when %s",
    (flag) => {
      const updated = { ...plan, [flag]: true };
      const before = Date.parse(plan.startAt) - 1000;
      expect(planView(updated, before)).toBe("PENDING");
      expect(planStatusLabel(updated, before)).toBe(
        flag === "eventChanged" ? "Review event" : "Event unavailable",
      );
      expect(canCancelPlan(updated, before)).toBe(true);
      expect(updated.status).toBe("ACCEPTED");
    },
  );
  it("does not invalidate an unchanged ongoing accepted event just because new invitations closed", () => {
    const ongoing = { ...plan, eventUnavailable: true };
    const during = Date.parse(plan.startAt) + 1000;
    expect(planView(ongoing, during)).toBe("UPCOMING");
    expect(planStatusLabel(ongoing, during)).toBe("Confirmed");
  });
});
