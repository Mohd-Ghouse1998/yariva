import type { UserProfile } from "../../../generated/prisma/client";
import type { PublicProfileDto } from "../dto/discovery.dto";

type DatingProfileFields = Pick<
  PublicProfileDto,
  | "verificationStatus"
  | "preferredRelationshipPace"
  | "occupation"
  | "languages"
  | "foodPreferences"
  | "profilePrompts"
  | "compatibility"
  | "sensitiveCompatibility"
>;

export function mapDatingProfileFields(
  profile: UserProfile | null,
  compatibility?: PublicProfileDto["compatibility"],
): DatingProfileFields {
  return {
    verificationStatus: profile?.verificationStatus ?? "UNVERIFIED",
    preferredRelationshipPace: profile?.preferredRelationshipPace ?? null,
    occupation: profile?.shareWorkDetails ? profile.occupation : null,
    languages: profile?.languages ?? [],
    foodPreferences: profile?.foodPreferences ?? [],
    profilePrompts: normalizePromptResponses(profile?.promptResponses),
    compatibility:
      compatibility ?? {
        score: 80,
        reasons: ["You chose each other and your intentions align"],
        sharedInterests: [],
        scheduleOverlap: null,
      },
    sensitiveCompatibility: profile?.shareSensitiveCompatibility
      ? {
          relocationOpenness: profile.relocationOpenness,
          careerPriority: profile.careerPriority,
          familyInvolvementComfort: profile.familyInvolvementComfort,
          marriageTimeline: profile.marriageTimeline,
          childrenPreference: profile.childrenPreference,
          religionSpirituality: profile.religionSpirituality,
        }
      : null,
  };
}

function normalizePromptResponses(
  value: unknown,
): Array<{ promptId: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is { promptId: string; answer: string } =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { promptId?: unknown }).promptId === "string" &&
        typeof (entry as { answer?: unknown }).answer === "string",
    )
    .map((entry) => ({
      promptId: entry.promptId,
      answer: entry.answer.slice(0, 500),
    }))
    .slice(0, 3);
}
