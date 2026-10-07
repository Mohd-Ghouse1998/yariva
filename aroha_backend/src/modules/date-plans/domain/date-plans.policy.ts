import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "../../../common/constants/error-codes";
import { AppException } from "../../../common/errors/app.exception";
import type { DatePlanMatchContext, DatePlanRecord } from "../infrastructure/date-plans.repository";

@Injectable()
export class DatePlanPolicy {
  assertMatchParticipant(userId: string, match: DatePlanMatchContext | null): asserts match is DatePlanMatchContext {
    if (!match || (match.userLowId !== userId && match.userHighId !== userId)) {
      throw new AppException(404, ERROR_CODES.MATCH_NOT_FOUND, "Match not found");
    }
  }

  assertActiveMatch(userId: string, match: DatePlanMatchContext | null): asserts match is DatePlanMatchContext {
    this.assertMatchParticipant(userId, match);
    if (match.status !== "ACTIVE") {
      throw new AppException(409, ERROR_CODES.DATE_PLAN_MATCH_INACTIVE, "Date plans require an active match");
    }
    const actor = match.userLowId === userId ? match.userLow : match.userHigh;
    if (actor.status !== "ACTIVE" || actor.isDiscoveryFrozen) {
      throw new AppException(403, ERROR_CODES.FORBIDDEN, "Account state does not allow date planning");
    }
  }

  assertPlanParticipant(userId: string, plan: DatePlanRecord | null): asserts plan is DatePlanRecord {
    if (!plan) {
      throw new AppException(404, ERROR_CODES.DATE_PLAN_NOT_FOUND, "Date plan not found");
    }
    if (plan.match.userLowId !== userId && plan.match.userHighId !== userId) {
      throw new AppException(404, ERROR_CODES.DATE_PLAN_NOT_ACCESSIBLE, "Date plan not found");
    }
  }

  assertPlanMatchActive(plan: DatePlanRecord): void {
    if (plan.match.status !== "ACTIVE") {
      throw new AppException(409, ERROR_CODES.DATE_PLAN_MATCH_INACTIVE, "This match is no longer active");
    }
  }

  assertCanRespond(plan: DatePlanRecord, allowed: DatePlanRecord["status"][]): void {
    if (!allowed.includes(plan.status)) {
      throw new AppException(
        409,
        ERROR_CODES.DATE_PLAN_INVALID_STATE,
        `Date plan cannot change from ${plan.status}`,
      );
    }
  }

  otherParticipant(userId: string, match: { userLowId: string; userHighId: string }): string {
    return match.userLowId === userId ? match.userHighId : match.userLowId;
  }
}
