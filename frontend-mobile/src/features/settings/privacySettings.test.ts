import { describe, expect, it } from "vitest";
import type { MyProfileDto } from "../../types/profile";
import { privacySettingsToProfileUpdate, profileToPrivacySettings } from "./privacySettings";

const profile = {
  isHidden: false,
  isPaused: false,
  hideAge: false,
  hideDistance: false,
  isIncognito: false,
  hideFromContacts: true,
  shareSensitiveCompatibility: false,
} as MyProfileDto;

describe("privacy visibility state", () => {
  it("preserves the stored unsupported contacts flag without writing it", () => {
    const value = profileToPrivacySettings(profile);
    expect(value.hideFromContacts).toBe(true);
    expect(privacySettingsToProfileUpdate({ ...value, isIncognito: true }, value)).toEqual({ isIncognito: true });
  });
  it("normalizes contradictory legacy flags to one conservative mode", () => {
    const value = profileToPrivacySettings({ ...profile, isHidden: true, isPaused: true });
    expect(value.visibility).toBe("HIDDEN");
  });

  it.each([
    ["VISIBLE", false, false],
    ["PAUSED", false, true],
    ["HIDDEN", true, false],
  ] as const)("writes %s without contradictory flags", (visibility, isHidden, isPaused) => {
    const value = profileToPrivacySettings(profile);
    const update = privacySettingsToProfileUpdate({ ...value, visibility }, {
      ...value, visibility: visibility === "VISIBLE" ? "PAUSED" : "VISIBLE",
    });
    expect({ isHidden: update.isHidden, isPaused: update.isPaused }).toEqual({
      isHidden,
      isPaused,
    });
  });

  it("keeps legacy defaults and sends only the edited field", () => {
    const value = profileToPrivacySettings({ ...profile, hideAge: true, fieldAudiences: { work: "MATCHES" } });
    expect(value.fieldAudiences).toMatchObject({ intro: "ALL_ELIGIBLE", age: "ONLY_ME", work: "MATCHES", marriageTimeline: "ONLY_ME" });
    expect(privacySettingsToProfileUpdate({
      ...value, fieldAudiences: { ...value.fieldAudiences, marriageTimeline: "MATCHES" },
    }, value)).toEqual({ fieldAudiences: { marriageTimeline: "MATCHES" } });
  });
});
