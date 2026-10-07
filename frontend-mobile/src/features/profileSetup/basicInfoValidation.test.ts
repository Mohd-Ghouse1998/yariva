import { describe, expect, it } from "vitest";
import { validateBasicInfoText } from "./basicInfoValidation";

const valid = {
  displayName: "Aarav",
  pronouns: "he/him",
  city: "Hyderabad",
  region: "Telangana",
  countryCode: "IN",
};

describe("basic profile text validation", () => {
  it("accepts values supported by the profile DTO", () => {
    expect(validateBasicInfoText(valid)).toBeNull();
  });

  it("requires a real two-letter country code", () => {
    expect(validateBasicInfoText({ ...valid, countryCode: "1N" })).toBe(
      "Enter a valid 2-letter country code, such as IN.",
    );
  });

  it("matches backend text limits", () => {
    expect(validateBasicInfoText({ ...valid, displayName: "x".repeat(81) })).toBe(
      "Keep your name within 80 characters.",
    );
    expect(validateBasicInfoText({ ...valid, city: "x".repeat(121) })).toBe(
      "Keep your city within 120 characters.",
    );
  });
});
