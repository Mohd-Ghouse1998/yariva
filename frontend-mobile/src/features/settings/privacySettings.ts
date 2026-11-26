import type { MyProfileDto, ProfileAudience, ProfileField, UpdateMyProfileRequest } from "../../types/profile";

export type VisibilityMode = "VISIBLE" | "PAUSED" | "HIDDEN";

export const AUDIENCE_LABELS: Record<ProfileAudience, string> = {
  ALL_ELIGIBLE: "All eligible viewers",
  MATCHES: "Active matches",
  ONLY_ME: "Only me",
};

type FieldOption = { key: ProfileField; label: string; description?: string };

export const PROFILE_DETAIL_FIELDS: FieldOption[] = [
  { key: "intro", label: "Introduction", description: "Headline, bio and profile prompts" },
  { key: "interests", label: "Interests", description: "Interests, languages and food preferences" },
  { key: "lifestyle", label: "Lifestyle", description: "Habits and relationship pace" },
  { key: "location", label: "Locality", description: "City and region" },
  { key: "age", label: "Age" },
  { key: "distance", label: "Distance" },
  { key: "gender", label: "Gender" },
  { key: "pronouns", label: "Pronouns" },
  { key: "work", label: "Work or study" },
];

export const PERSONAL_DETAIL_FIELDS: FieldOption[] = [
  { key: "relocationOpenness", label: "Relocation" },
  { key: "careerPriority", label: "Career priority" },
  { key: "familyInvolvementComfort", label: "Family involvement" },
  { key: "marriageTimeline", label: "Marriage timeline" },
  { key: "childrenPreference", label: "Children" },
  { key: "religionSpirituality", label: "Religion and spirituality" },
];

export interface PrivacySettingsValue {
  visibility: VisibilityMode;
  isIncognito: boolean;
  hideFromContacts: boolean;
  fieldAudiences: Record<ProfileField, ProfileAudience>;
}

export const profileToPrivacySettings = (profile: MyProfileDto): PrivacySettingsValue => ({
  visibility: profile.isHidden ? "HIDDEN" : profile.isPaused ? "PAUSED" : "VISIBLE",
  isIncognito: profile.isIncognito,
  hideFromContacts: profile.hideFromContacts,
  fieldAudiences: {
    intro: "ALL_ELIGIBLE",
    interests: "ALL_ELIGIBLE",
    lifestyle: "ALL_ELIGIBLE",
    location: "ALL_ELIGIBLE",
    age: profile.hideAge ? "ONLY_ME" : "ALL_ELIGIBLE",
    distance: profile.hideDistance ? "ONLY_ME" : "ALL_ELIGIBLE",
    gender: "ALL_ELIGIBLE",
    pronouns: "ALL_ELIGIBLE",
    work: profile.shareWorkDetails ? "ALL_ELIGIBLE" : "ONLY_ME",
    relocationOpenness: profile.shareSensitiveCompatibility ? "ALL_ELIGIBLE" : "ONLY_ME",
    careerPriority: profile.shareSensitiveCompatibility ? "ALL_ELIGIBLE" : "ONLY_ME",
    familyInvolvementComfort: profile.shareSensitiveCompatibility ? "ALL_ELIGIBLE" : "ONLY_ME",
    marriageTimeline: profile.shareSensitiveCompatibility ? "ALL_ELIGIBLE" : "ONLY_ME",
    childrenPreference: profile.shareSensitiveCompatibility ? "ALL_ELIGIBLE" : "ONLY_ME",
    religionSpirituality: profile.shareSensitiveCompatibility ? "ALL_ELIGIBLE" : "ONLY_ME",
    ...profile.fieldAudiences,
  },
});

export const privacySettingsToProfileUpdate = (
  value: PrivacySettingsValue,
  previous: PrivacySettingsValue,
): UpdateMyProfileRequest => {
  const update: UpdateMyProfileRequest = {};
  if (value.visibility !== previous.visibility) {
    update.isHidden = value.visibility === "HIDDEN";
    update.isPaused = value.visibility === "PAUSED";
  }
  if (value.isIncognito !== previous.isIncognito) update.isIncognito = value.isIncognito;
  for (const { key } of [...PROFILE_DETAIL_FIELDS, ...PERSONAL_DETAIL_FIELDS]) {
    const selected = value.fieldAudiences[key];
    if (selected !== previous.fieldAudiences[key]) (update.fieldAudiences ??= {})[key] = selected;
  }
  return update;
};
