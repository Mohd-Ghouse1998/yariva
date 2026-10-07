import { describe, expect, it } from "vitest";
import { CONNECTION_INTENT } from "../types/enums";
import { CONNECTION_INTENT_OPTIONS, normalizeConnectionIntents } from "./connectionIntents";

describe("persistent intention contract", () => {
  it("offers every supported preference in personal and partner editors", () => {
    expect(CONNECTION_INTENT_OPTIONS.map((option) => option.value)).toEqual(CONNECTION_INTENT);
    expect(CONNECTION_INTENT_OPTIONS.every((option) => option.label.length > 0)).toBe(true);
  });
  it("never truncates or replaces supported legacy preferences", () => {
    expect(normalizeConnectionIntents(CONNECTION_INTENT)).toEqual(CONNECTION_INTENT);
    expect(
      normalizeConnectionIntents(["FRIENDSHIP", "DATING", "FRIENDSHIP", "RELATIONSHIP"]),
    ).toEqual(["FRIENDSHIP", "DATING", "RELATIONSHIP"]);
  });
});
