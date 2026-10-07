import { FeatureFlagRuleService } from "./feature-flags.domain";

describe("FeatureFlagRuleService", () => {
  const service = new FeatureFlagRuleService();

  it("requires enabled flags", () => {
    expect(
      service.evaluate(
        {
          enabled: false,
          deletedAt: null,
          scope: "GLOBAL",
        } as any,
        { userId: "user-1" },
      ),
    ).toBe(false);
  });

  it("honors allowlists", () => {
    expect(
      service.evaluate(
        {
          enabled: true,
          deletedAt: null,
          scope: "USER_ALLOWLIST",
          allowlistUserIds: ["user-1"],
        } as any,
        { userId: "user-1" },
      ),
    ).toBe(true);
    expect(
      service.evaluate(
        {
          enabled: true,
          deletedAt: null,
          scope: "USER_ALLOWLIST",
          allowlistUserIds: ["user-1"],
        } as any,
        { userId: "user-2" },
      ),
    ).toBe(false);
  });

  it("uses deterministic percentage buckets", () => {
    const flag = {
      key: "test.flag",
      enabled: true,
      deletedAt: null,
      scope: "USER_PERCENTAGE",
      rolloutPercentage: 50,
    } as any;

    expect(service.evaluate(flag, { userId: "user-1" })).toBe(
      service.evaluate(flag, { userId: "user-1" }),
    );
  });
});

