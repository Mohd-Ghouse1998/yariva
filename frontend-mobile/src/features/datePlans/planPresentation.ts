import type { DatePlanStatus } from "../../types/datePlan";

export type PlanView = "UPCOMING" | "PENDING" | "PAST";
export interface PlanSchedule {
  status: DatePlanStatus;
  startAt: string;
  durationMinutes?: number;
}

// ISO instants include their offset; device timezone does not decide expiry.
// Duo has no duration contract: past means its scheduled start has passed,
// never that the four people attended or completed it.
export const planHasElapsed = (plan: PlanSchedule, now: number): boolean => {
  const start = Date.parse(plan.startAt);
  const duration = Math.max(0, plan.durationMinutes ?? 0) * 60_000;
  return Number.isFinite(start) && start + duration <= now;
};

export const planView = (plan: PlanSchedule, now: number): PlanView => {
  if (["DECLINED", "CANCELLED", "COMPLETED"].includes(plan.status) || planHasElapsed(plan, now))
    return "PAST";
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
export const planStatusLabel = (plan: PlanSchedule, now: number): string => {
  if (
    planHasElapsed(plan, now) &&
    ["DRAFT", "PROPOSED", "COUNTERED", "ACCEPTED"].includes(plan.status)
  )
    return plan.status === "ACCEPTED" ? "Past · Confirmed" : "Past proposal";
  return LABELS[plan.status];
};
