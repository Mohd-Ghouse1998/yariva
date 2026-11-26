import type { RelationshipPace } from "../../types/enums";
import type { MyProfileDto, OccupationCategory, PrivatePhotoDto, UpdateMyProfileRequest } from "../../types/profile";
import { PROFILE_PROMPTS } from "./profilePrompts";

export interface ProfileEditFormValue {
  headline: string;
  bio: string;
  occupation: string;
  occupationCategory: OccupationCategory | null;
  languages: string;
  foodPreferences: string;
  relationshipPace: RelationshipPace | null;
  relocationOpenness: string;
  careerPriority: string;
  familyComfort: string;
  marriageTimeline: string;
  childrenPreference: string;
  religionSpirituality: string;
  promptResponses: Record<string, string>;
}

export const splitUniqueList = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const profileToEditForm = (profile: MyProfileDto): ProfileEditFormValue => ({
  headline: profile.headline ?? "",
  bio: profile.bio ?? "",
  occupation: profile.occupation ?? "",
  occupationCategory: profile.occupationCategory ?? null,
  languages: profile.languages.join(", "),
  foodPreferences: profile.foodPreferences.join(", "),
  relationshipPace: profile.preferredRelationshipPace,
  relocationOpenness: profile.relocationOpenness ?? "",
  careerPriority: profile.careerPriority ?? "",
  familyComfort: profile.familyInvolvementComfort ?? "",
  marriageTimeline: profile.marriageTimeline ?? "",
  childrenPreference: profile.childrenPreference ?? "",
  religionSpirituality: profile.religionSpirituality ?? "",
  promptResponses: Object.fromEntries(
    profile.promptResponses.map((prompt) => [prompt.promptId, prompt.answer]),
  ),
});

export const editFormToProfileUpdate = (form: ProfileEditFormValue): UpdateMyProfileRequest => ({
  headline: form.headline.trim() || null,
  bio: form.bio.trim(),
  occupation: form.occupation.trim() || null,
  occupationCategory: form.occupationCategory,
  languages: splitUniqueList(form.languages),
  foodPreferences: splitUniqueList(form.foodPreferences),
  preferredRelationshipPace: form.relationshipPace,
  relocationOpenness: form.relocationOpenness.trim() || null,
  careerPriority: form.careerPriority.trim() || null,
  familyInvolvementComfort: form.familyComfort.trim() || null,
  marriageTimeline: form.marriageTimeline.trim() || null,
  childrenPreference: form.childrenPreference.trim() || null,
  religionSpirituality: form.religionSpirituality.trim() || null,
  promptResponses: PROFILE_PROMPTS.slice(0, 3)
    .map((prompt) => ({
      promptId: prompt.id,
      answer: form.promptResponses[prompt.id]?.trim() ?? "",
    }))
    .filter((prompt) => prompt.answer.length > 0),
});

export const profileEditSignature = (form: ProfileEditFormValue): string =>
  JSON.stringify(editFormToProfileUpdate(form));

/** Focused editors must not overwrite fields owned by another page. */
export const profileExtrasUpdate = (
  form: ProfileEditFormValue,
  prompts: boolean,
): UpdateMyProfileRequest => {
  const all = editFormToProfileUpdate(form);
  if (prompts) return { promptResponses: all.promptResponses };
  return {
    occupation: all.occupation,
    occupationCategory: all.occupationCategory,
    languages: all.languages,
    foodPreferences: all.foodPreferences,
    preferredRelationshipPace: all.preferredRelationshipPace,
    relocationOpenness: all.relocationOpenness,
    careerPriority: all.careerPriority,
    familyInvolvementComfort: all.familyInvolvementComfort,
    marriageTimeline: all.marriageTimeline,
    childrenPreference: all.childrenPreference,
    religionSpirituality: all.religionSpirituality,
  };
};

export const validateProfileEditForm = (
  form: ProfileEditFormValue,
): { valid: true } | { valid: false; message: string } => {
  if (form.headline.length > 140) {
    return { valid: false, message: "Keep your headline within 140 characters." };
  }
  if (form.bio.trim().length < 20) {
    return { valid: false, message: "Write at least 20 characters in your bio." };
  }
  if (form.bio.length > 1000) {
    return { valid: false, message: "Keep your bio within 1,000 characters." };
  }
  for (const [label, value] of [
    ["languages", form.languages],
    ["food preferences", form.foodPreferences],
  ] as const) {
    const entries = splitUniqueList(value);
    if (entries.length > 10) {
      return { valid: false, message: `Add no more than 10 ${label}.` };
    }
    if (entries.some((entry) => entry.length > 80)) {
      return { valid: false, message: `Keep each ${label} entry within 80 characters.` };
    }
  }
  for (const [label, value, max] of [
    ["work or study", form.occupation, 80],
    ["relocation openness", form.relocationOpenness, 80],
    ["career priority", form.careerPriority, 80],
    ["family involvement comfort", form.familyComfort, 120],
    ["marriage timeline", form.marriageTimeline, 80],
    ["children preference", form.childrenPreference, 80],
    ["religion or spirituality", form.religionSpirituality, 120],
  ] as const) {
    if (value.length > max) {
      return { valid: false, message: `Keep ${label} within ${max} characters.` };
    }
  }
  if (Object.values(form.promptResponses).some((answer) => answer.length > 500)) {
    return { valid: false, message: "Keep each dating prompt within 500 characters." };
  }
  return { valid: true };
};

export const moveProfilePhoto = (
  photos: PrivatePhotoDto[],
  photoId: string,
  direction: -1 | 1,
): PrivatePhotoDto[] => {
  const from = photos.findIndex((photo) => photo.id === photoId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= photos.length) return photos;
  const next = [...photos];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((photo, position) => ({ ...photo, position }));
};
