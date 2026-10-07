import { describe, expect, it } from "vitest";
import type { MyProfileDto } from "../../types/profile";
import { privacySettingsToProfileUpdate, profileToPrivacySettings } from "./privacySettings";

describe("privacy visibility state", () => {
  it("preserves the stored unsupported contacts flag without writing it", () => {
    const value = profileToPrivacySettings({
      isHidden: false, isPaused: false, hideAge: false, hideDistance: false,
      isIncognito: false, hideFromContacts: true, shareSensitiveCompatibility: false,
    } as MyProfileDto);
    expect(value.hideFromContacts).toBe(true);
    expect(privacySettingsToProfileUpdate(value)).not.toHaveProperty("hideFromContacts");
  });
  it("normalizes contradictory legacy flags to one conservative mode", () => {
    const value = profileToPrivacySettings({
      isHidden: true,
      isPaused: true,
      hideAge: false,
      hideDistance: false,
      isIncognito: false,
      hideFromContacts: false,
      shareSensitiveCompatibility: false,
    } as MyProfileDto);
    expect(value.visibility).toBe("HIDDEN");
  });

  it.each([
    ["VISIBLE", false, false],
    ["PAUSED", false, true],
    ["HIDDEN", true, false],
  ] as const)("writes %s without contradictory flags", (visibility, isHidden, isPaused) => {
    const update = privacySettingsToProfileUpdate({
      visibility,
      hideAge: false,
      hideDistance: false,
      isIncognito: false,
      hideFromContacts: false,
      shareSensitiveCompatibility: false,
    });
    expect({ isHidden: update.isHidden, isPaused: update.isPaused }).toEqual({
      isHidden,
      isPaused,
    });
  });
});
