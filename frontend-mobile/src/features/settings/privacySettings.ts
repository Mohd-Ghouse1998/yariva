import type { MyProfileDto, UpdateMyProfileRequest } from "../../types/profile";

export type VisibilityMode = "VISIBLE" | "PAUSED" | "HIDDEN";

export interface PrivacySettingsValue {
  visibility: VisibilityMode;
  hideAge: boolean;
  hideDistance: boolean;
  isIncognito: boolean;
  hideFromContacts: boolean;
  shareSensitiveCompatibility: boolean;
}

export const profileToPrivacySettings = (profile: MyProfileDto): PrivacySettingsValue => ({
  visibility: profile.isHidden ? "HIDDEN" : profile.isPaused ? "PAUSED" : "VISIBLE",
  hideAge: profile.hideAge,
  hideDistance: profile.hideDistance,
  isIncognito: profile.isIncognito,
  hideFromContacts: profile.hideFromContacts,
  shareSensitiveCompatibility: profile.shareSensitiveCompatibility,
});

export const privacySettingsToProfileUpdate = (
  value: PrivacySettingsValue,
): UpdateMyProfileRequest => ({
  isHidden: value.visibility === "HIDDEN",
  isPaused: value.visibility === "PAUSED",
  hideAge: value.hideAge,
  hideDistance: value.hideDistance,
  isIncognito: value.isIncognito,
  shareSensitiveCompatibility: value.shareSensitiveCompatibility,
});
