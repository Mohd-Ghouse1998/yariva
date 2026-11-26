import { AppException } from "../../../common/errors/app.exception";
import { ERROR_CODES } from "../../../common/constants/error-codes";

export const SENSITIVE_PROFILE_FIELDS = [
  "relocationOpenness", "careerPriority", "familyInvolvementComfort",
  "marriageTimeline", "childrenPreference", "religionSpirituality",
] as const;

const PROFILE_FIELDS = [
  "intro", "interests", "lifestyle", "location", "age", "distance", "gender", "pronouns", "work", ...SENSITIVE_PROFILE_FIELDS,
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileAudience = "ALL_ELIGIBLE" | "MATCHES" | "ONLY_ME";
export type ProfileAudiences = Partial<Record<ProfileField, ProfileAudience>>;

interface ProfileAudienceSource {
  fieldAudiences?: unknown;
  hideAge?: boolean;
  hideDistance?: boolean;
  shareWorkDetails?: boolean;
  shareSensitiveCompatibility?: boolean;
}

function isAudience(value: unknown): value is ProfileAudience {
  return value === "ALL_ELIGIBLE" || value === "MATCHES" || value === "ONLY_ME";
}

export function readProfileAudiences(value: unknown): ProfileAudiences {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const result: ProfileAudiences = {};
  for (const field of PROFILE_FIELDS) {
    const audience = (value as Record<string, unknown>)[field];
    if (isAudience(audience)) result[field] = audience;
  }
  return result;
}

export function validateProfileAudiences(value: unknown): ProfileAudiences {
  const audiences = readProfileAudiences(value);
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== Object.keys(audiences).length) {
    throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, "Invalid profile field or audience");
  }
  return audiences;
}

function profileAudience(profile: ProfileAudienceSource, field: ProfileField): ProfileAudience {
  const stored = profile.fieldAudiences as Record<string, unknown> | null | undefined;
  const audience = stored?.[field];
  if (isAudience(audience)) return audience;
  if ((field === "age" && profile.hideAge) || (field === "distance" && profile.hideDistance) ||
      (field === "work" && !profile.shareWorkDetails) ||
      (SENSITIVE_PROFILE_FIELDS.some(sensitive => field === sensitive) && !profile.shareSensitiveCompatibility)) return "ONLY_ME";
  return "ALL_ELIGIBLE";
}

export function effectiveProfileAudiences(profile: ProfileAudienceSource): Record<ProfileField, ProfileAudience> {
  return Object.fromEntries(PROFILE_FIELDS.map(field => [field, profileAudience(profile, field)])) as Record<ProfileField, ProfileAudience>;
}

export function canViewProfileField(profile: ProfileAudienceSource | null, field: ProfileField, activeMatch = false): boolean {
  if (!profile) return false;
  const audience = profileAudience(profile, field);
  return audience === "ALL_ELIGIBLE" || (audience === "MATCHES" && activeMatch);
}
