import { AppException } from "../../../common/errors/app.exception";
import { DatePlanPolicy } from "./date-plans.policy";
import { resolveMutualMeetAgain } from "./date-plans.privacy";
import type { DatePlanRecord } from "../infrastructure/date-plans.repository";

describe("date-plan domain", () => {
  const policy = new DatePlanPolicy();

  it("allows replies only from proposal states", () => {
    expect(() =>
      policy.assertCanRespond({ status: "PROPOSED" } as DatePlanRecord, ["PROPOSED", "COUNTERED"]),
    ).not.toThrow();
    expect(() =>
      policy.assertCanRespond({ status: "COMPLETED" } as DatePlanRecord, ["PROPOSED", "COUNTERED"]),
    ).toThrow(AppException);
  });

  it("conceals plans from non-participants and rejects inactive matches", () => {
    const plan = {
      match: { userLowId: "user-1", userHighId: "user-2", status: "ACTIVE" },
    } as DatePlanRecord;
    expect(() => policy.assertPlanParticipant("user-3", plan)).toThrow(AppException);
    expect(() => policy.assertPlanParticipant("user-1", plan)).not.toThrow();
    expect(() => policy.assertPlanMatchActive({
      ...plan,
      match: { ...plan.match, status: "ENDED" },
    } as DatePlanRecord)).toThrow(AppException);
  });

  it("reveals meet-again only when both answers are positive", () => {
    expect(resolveMutualMeetAgain([true])).toBeNull();
    expect(resolveMutualMeetAgain([true, false])).toBeNull();
    expect(resolveMutualMeetAgain([true, true])).toBe("MUTUAL");
  });
});
