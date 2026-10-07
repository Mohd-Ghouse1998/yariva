import { describe, expect, it } from "vitest";
import { humanizeProfileValue } from "./format";
describe("profile enum presentation", () => {
  it.each([["WEEKLY", "Weekly"], ["OMNIVORE", "Omnivore"], ["BALANCED", "Balanced"], ["COMMITTED_RELATIONSHIP", "Committed relationship"], ["socialEnergy", "Social energy"]])("humanizes %s without machine formatting", (value, label) => {
    expect(humanizeProfileValue(value)).toBe(label);
  });
  it("keeps optional absence and already authored text", () => {
    expect(humanizeProfileValue(null)).toBeNull();
    expect(humanizeProfileValue("English and Telugu")).toBe("English and Telugu");
  });
});
