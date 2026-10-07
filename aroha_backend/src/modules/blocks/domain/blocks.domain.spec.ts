import { BlockPolicyService } from "./blocks.domain";

describe("BlockPolicyService", () => {
  const service = new BlockPolicyService();

  it("rejects self blocks", () => {
    expect(() => service.assertCanBlock("user-1", "user-1")).toThrow(
      "Users cannot block themselves",
    );
  });

  it("allows different users", () => {
    expect(() => service.assertCanBlock("user-1", "user-2")).not.toThrow();
  });
});

