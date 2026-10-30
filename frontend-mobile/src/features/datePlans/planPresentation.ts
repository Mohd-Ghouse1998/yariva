import type { DatePlanStatus } from "../../types/datePlan";
import type { EventTranslator } from "../events/eventPresentation";

export type PlanView = "UPCOMING" | "PENDING" | "PAST";
export interface PlanSchedule {
  status: DatePlanStatus;
  startAt: string;
  durationMinutes?: number;
  eventChanged?: boolean;
  eventUnavailable?: boolean;
}

// ISO instants include their offset; device timezone does not decide expiry.
// Duo has no duration contract: past means its scheduled start has passed,
// never that the four people attended or completed it.
export const planHasElapsed = (plan: PlanSchedule, now: number): boolean => {
  const start = Date.parse(plan.startAt);
  const duration = Math.max(0, plan.durationMinutes ?? 0) * 60_000;
  return Number.isFinite(start) && start + duration <= now;
};

// An accepted snapshot does not confirm later organizer edits. Starting an
// unchanged accepted event closes new invitations, not the existing meetup.
export const planNeedsEventReview = (plan: PlanSchedule, now: number): boolean =>
  ["DRAFT", "PROPOSED", "COUNTERED", "ACCEPTED"].includes(plan.status) &&
  !planHasElapsed(plan, now) &&
  Boolean(plan.eventChanged || (plan.eventUnavailable && Date.parse(plan.startAt) > now));

export const planView = (plan: PlanSchedule, now: number): PlanView => {
  if (["DECLINED", "CANCELLED", "COMPLETED"].includes(plan.status) || planHasElapsed(plan, now))
    return "PAST";
  if (planNeedsEventReview(plan, now)) return "PENDING";
  return plan.status === "ACCEPTED" ? "UPCOMING" : "PENDING";
};

export const canRespondToPlan = (plan: PlanSchedule, now: number): boolean =>
  !planHasElapsed(plan, now) && ["PROPOSED", "COUNTERED"].includes(plan.status);

export const canCancelPlan = (plan: PlanSchedule, now: number): boolean =>
  plan.status === "ACCEPTED" && !planHasElapsed(plan, now);

const LABELS: Record<DatePlanStatus, string> = {
  DRAFT: "Draft",
  PROPOSED: "Reply needed",
  COUNTERED: "Updated",
  ACCEPTED: "Confirmed",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Done",
};
export const planStatusLabel = (plan: PlanSchedule, now: number, t?: EventTranslator): string => {
  if (
    planHasElapsed(plan, now) &&
    ["DRAFT", "PROPOSED", "COUNTERED", "ACCEPTED"].includes(plan.status)
  )
    return plan.status === "ACCEPTED" ? "Past · Confirmed" : "Past proposal";
  if (planNeedsEventReview(plan, now))
    return plan.eventChanged ? (t?.("events.plan.review") ?? "Review event") : (t?.("events.plan.unavailable") ?? "Event unavailable");
  return LABELS[plan.status];
};
