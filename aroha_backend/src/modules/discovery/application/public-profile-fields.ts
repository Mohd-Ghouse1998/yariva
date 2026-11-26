import type { UserProfile } from "../../../generated/prisma/client";
import { canViewProfileField, SENSITIVE_PROFILE_FIELDS } from "../../profiles/domain/profile-field-audience";
import type { PublicProfileDto } from "../dto/discovery.dto";

type DatingProfileFields = Pick<
  PublicProfileDto,
  | "headline"
  | "bio"
  | "age"
  | "gender"
  | "pronouns"
  | "interests"
  | "lifestyle"
  | "verificationStatus"
  | "preferredRelationshipPace"
  | "occupation"
  | "languages"
  | "foodPreferences"
  | "profilePrompts"
  | "compatibility"
  | "sensitiveCompatibility"
>;

interface ProfileFieldContext {
  activeMatch?: boolean;
  compatibility?: PublicProfileDto["compatibility"];
  interests: PublicProfileDto["interests"];
  lifestyle: PublicProfileDto["lifestyle"] | null;
}

export function mapDatingProfileFields(
  profile: UserProfile | null,
  { activeMatch, compatibility, interests, lifestyle }: ProfileFieldContext,
): DatingProfileFields {
  const show = (field: Parameters<typeof canViewProfileField>[1]) => canViewProfileField(profile, field, activeMatch);
  const visibleLifestyle = show("lifestyle") ? lifestyle : null;
  const sensitive = SENSITIVE_PROFILE_FIELDS.map(field => [field, show(field) ? profile?.[field] ?? null : null] as const);
  return {
    headline: show("intro") ? profile?.headline ?? null : null,
    bio: show("intro") ? profile?.bio ?? null : null,
    age: show("age") && profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null,
    gender: show("gender") ? profile?.gender ?? null : null,
    pronouns: show("pronouns") ? profile?.pronouns ?? null : null,
    interests: show("interests") ? interests : [],
    lifestyle: {
      smoking: visibleLifestyle?.smoking ?? null,
      drinking: visibleLifestyle?.drinking ?? null,
      exercise: visibleLifestyle?.exercise ?? null,
      diet: visibleLifestyle?.diet ?? null,
      petPreference: visibleLifestyle?.petPreference ?? null,
      sleepPattern: visibleLifestyle?.sleepPattern ?? null,
      socialEnergy: visibleLifestyle?.socialEnergy ?? null,
    },
    verificationStatus: profile?.verificationStatus ?? "UNVERIFIED",
    preferredRelationshipPace: show("lifestyle") ? profile?.preferredRelationshipPace ?? null : null,
    occupation: show("work") ? profile?.occupation ?? null : null,
    languages: show("interests") ? profile?.languages ?? [] : [],
    foodPreferences: show("interests") ? profile?.foodPreferences ?? [] : [],
    profilePrompts: show("intro") ? normalizePromptResponses(profile?.promptResponses) : [],
    compatibility:
      compatibility ?? {
        score: 80,
        reasons: [],
        sharedInterests: [],
        scheduleOverlap: null,
      },
    sensitiveCompatibility: sensitive.some(([, value]) => value !== null)
      ? Object.fromEntries(sensitive) as NonNullable<PublicProfileDto["sensitiveCompatibility"]> : null,
  };
}

export function mapProfileLocality(profile: UserProfile | null, activeMatch = false) {
  const visible = canViewProfileField(profile, "location", activeMatch) ? profile : null;
  return { city: visible?.city ?? null, region: visible?.region ?? null, countryCode: visible?.countryCode ?? null };
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
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
