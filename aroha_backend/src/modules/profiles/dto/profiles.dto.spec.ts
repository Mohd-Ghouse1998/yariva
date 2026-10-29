import "reflect-metadata";
import { validateSync } from "class-validator";
import {
  UpdateDiscoveryPreferenceDto,
  UpdateMyProfileDto,
} from "./profiles.dto";

const valid = {
  minAge: 18,
  maxAge: 99,
  maxDistanceKm: 50,
  intentFilter: [],
  preferredGenders: [],
  includeRecentlyActiveOnly: false,
  preferSameCity: false,
};
const errors = (extra: Record<string, unknown>) =>
  validateSync(Object.assign(new UpdateDiscoveryPreferenceDto(), valid, extra));

describe("People filter validation", () => {
  it("accepts existing clients and valid new selections", () => {
    expect(errors({})).toHaveLength(0);
    expect(
      errors({
        interestTagIds: ["00000000-0000-4000-8000-000000000001"],
        languageFilter: ["Telugu"],
        occupationFilter: "Engineer",
        occupationCategoryFilter: ["TECHNOLOGY"],
        smokingFilter: ["NEVER"],
        drinkingFilter: ["SOCIAL"],
        exerciseFilter: ["WEEKLY"],
      }),
    ).toHaveLength(0);
  });

  it.each([
    { occupationCategoryFilter: null },
    { occupationCategoryFilter: ["UNKNOWN"] },
    { occupationCategoryFilter: ["TECHNOLOGY", "TECHNOLOGY"] },
    { interestTagIds: null },
    { interestTagIds: ["invalid"] },
    { languageFilter: null },
    { languageFilter: Array(11).fill("Telugu") },
    { occupationFilter: "x".repeat(81) },
    { smokingFilter: ["INVALID"] },
    { exerciseFilter: null },
    { drinkingFilter: ["SOCIAL", "SOCIAL"] },
  ])("rejects malformed filters: %p", (extra) => {
    expect(errors(extra).length).toBeGreaterThan(0);
  });

  it("accepts optional category selection and clearing, rejects unknown categories", () => {
    for (const occupationCategory of [undefined, null, "TECHNOLOGY"]) {
      expect(validateSync(Object.assign(new UpdateMyProfileDto(), { occupationCategory }))).toHaveLength(0);
    }
    expect(validateSync(Object.assign(new UpdateMyProfileDto(), { occupationCategory: "UNKNOWN" })).length).toBeGreaterThan(0);
  });

  it("rejects a nullable work visibility flag", () => {
    const errors = validateSync(
      Object.assign(new UpdateMyProfileDto(), { shareWorkDetails: null }),
    );
    expect(errors.some((error) => error.property === "shareWorkDetails")).toBe(
      true,
    );
  });
});
