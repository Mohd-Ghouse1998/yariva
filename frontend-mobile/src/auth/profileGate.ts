import type { ProfileCompletionCriterion } from "../types/enums";
import type { ProfileCompletionStatusDto } from "../types/auth";

export const PROFILE_SETUP_STEPS = [
  "basic-info",
  "bio",
  "intent",
  "interests",
  "lifestyle",
  "schedule",
  "discovery-preferences",
  "communication-preferences",
  "photos",
  "review",
] as const;

export type ProfileSetupStep = (typeof PROFILE_SETUP_STEPS)[number];

const CRITERION_TO_STEP: Record<ProfileCompletionCriterion, ProfileSetupStep | null> = {
  DISPLAY_NAME: "basic-info",
  DATE_OF_BIRTH: "basic-info",
  AGE_18_PLUS: "basic-info",
  CITY: "basic-info",
  REGION: "basic-info",
  COUNTRY_CODE: "basic-info",
  LOCATION_COORDINATES: "basic-info",
  LOCATION_GEOHASH: "basic-info",
  BIO: "bio",
  INTENT: "intent",
  APPROVED_PHOTO: "photos",
  APPROVED_PRIMARY_PHOTO: "photos",
  DISCOVERY_PREFERENCE: "discovery-preferences",
  COMMUNICATION_PREFERENCE: "communication-preferences",
  PROFILE_HIDDEN: null,
  ACCOUNT_NOT_ACTIVE: null,
};

export function nextSetupStep(status: ProfileCompletionStatusDto | null): ProfileSetupStep {
  if (!status || status.isComplete) return "review";
  for (const step of PROFILE_SETUP_STEPS) {
    if (status.missingCriteria.some((c) => CRITERION_TO_STEP[c] === step)) {
      return step;
    }
  }
  return "review";
}

export function missingCriteriaForStep(
  status: ProfileCompletionStatusDto | null,
  step: ProfileSetupStep,
): ProfileCompletionCriterion[] {
  if (!status) return [];
  return status.missingCriteria.filter((c) => CRITERION_TO_STEP[c] === step);
}

export function readableCriterion(c: ProfileCompletionCriterion): string {
  switch (c) {
    case "DISPLAY_NAME":
      return "Add your name";
    case "BIO":
      return "Write a short bio (20–1000 characters)";
    case "DATE_OF_BIRTH":
      return "Add your date of birth";
    case "AGE_18_PLUS":
      return "You must be 18 or older";
    case "CITY":
      return "Add your city";
    case "REGION":
      return "Add your region";
    case "COUNTRY_CODE":
      return "Add your country";
    case "LOCATION_COORDINATES":
      return "Share your approximate location";
    case "LOCATION_GEOHASH":
      return "We need your location to show people nearby";
    case "INTENT":
      return "Pick what you’re here for";
    case "APPROVED_PHOTO":
      return "Add at least one approved photo";
    case "APPROVED_PRIMARY_PHOTO":
      return "Set an approved primary photo";
    case "DISCOVERY_PREFERENCE":
      return "Set your discovery preferences";
    case "COMMUNICATION_PREFERENCE":
      return "Set your communication preferences";
    case "PROFILE_HIDDEN":
      return "Unhide your profile to be discoverable";
    case "ACCOUNT_NOT_ACTIVE":
      return "Account isn’t active yet";
  }
}
