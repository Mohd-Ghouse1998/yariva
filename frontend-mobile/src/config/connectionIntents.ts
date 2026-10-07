import { CONNECTION_INTENT, type ConnectionIntent } from "../types/enums";

// Persistent personal intentions and partner filters share this vocabulary.
// Daily Scenes have their own three-value contract, not a profile preference.
export const CONNECTION_INTENT_LABELS: Record<ConnectionIntent, string> = {
  FRIENDSHIP: "Friendship",
  COMPANIONSHIP: "Companionship",
  SHARED_INTERESTS: "Shared interests",
  RELATIONSHIP: "Relationship",
  DATING: "Dating",
  COMMITTED_RELATIONSHIP: "Committed relationship",
  MARRIAGE_MINDED: "Marriage-minded",
};

export const CONNECTION_INTENT_OPTIONS = CONNECTION_INTENT.map((value) => ({
  value,
  label: CONNECTION_INTENT_LABELS[value],
}));

export const normalizeConnectionIntents = (
  values: readonly ConnectionIntent[],
): ConnectionIntent[] => [...new Set(values)];
