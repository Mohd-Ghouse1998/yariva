import { ERROR_CODES } from "../../common/constants/error-codes";
import { AppException } from "../../common/errors/app.exception";
import { haversineDistanceKm } from "../../common/utils/distance.util";
import { type Prisma } from "../../generated/prisma/client";
import { genderPreferenceMatches, isSocialIntent } from "../discovery/domain/discovery.domain";

export const CIRCLES_FLAG = "social.circles";
export const CHECK_IN_FLAG = "social.connection_check_in";
export const FIRST_CONNECTIONS_FLAG = "social.first_connections";
export const DAY_MS = 86_400_000;

export const socialUser = {
  id: true, status: true, deletedAt: true, isDiscoveryFrozen: true,
  isShadowBanned: true, isChatFrozen: true,
  profile: { select: {
    isComplete: true, deletedAt: true, displayName: true, isHidden: true, isPaused: true, isIncognito: true,
    dateOfBirth: true, gender: true, city: true, region: true, countryCode: true,
    locationLat: true, locationLng: true, completedAt: true,
  } },
  intents: { where: { deletedAt: null }, select: { intent: true } },
  discoveryPreference: { select: { preferredGenders: true, minAge: true, maxAge: true, maxDistanceKm: true } },
} satisfies Prisma.UserSelect;

export type SocialUser = Prisma.UserGetPayload<{ select: typeof socialUser }>;

export function ageInYears(birth: Date): number {
  const now = new Date();
  const hasBirthday = now.toISOString().slice(5, 10) >= birth.toISOString().slice(5, 10);
  return now.getUTCFullYear() - birth.getUTCFullYear() - Number(!hasBirthday);
}

export function isEligible(user: SocialUser): boolean {
  const profile = user.profile;
  return user.status === "ACTIVE" && !user.deletedAt && !user.isShadowBanned &&
    !user.isDiscoveryFrozen && !user.isChatFrozen && !!profile?.isComplete && !profile.deletedAt &&
    !!profile.dateOfBirth && ageInYears(profile.dateOfBirth) >= 18;
}

export function isFirstConnectionsEligible(user: SocialUser | null, now = Date.now()): boolean {
  const completed = user?.profile?.completedAt?.getTime();
  return !!user && completed != null && completed <= now && now - completed < 7 * DAY_MS &&
    isEligible(user) && !user.profile?.isHidden && !user.profile?.isPaused;
}

export function isPublic(profile: { isHidden: boolean; isPaused: boolean; isIncognito: boolean } | null): boolean {
  return !!profile && !profile.isHidden && !profile.isPaused && !profile.isIncognito;
}

export function nearby(a: SocialUser, b: SocialUser): boolean {
  const p = a.profile;
  const q = b.profile;
  if (!p?.city || !p.region || !p.countryCode || !q?.city || !q.region || !q.countryCode) return false;
  if (p.city.toLowerCase() !== q.city.toLowerCase() ||
      p.region.toLowerCase() !== q.region.toLowerCase() ||
      p.countryCode.toLowerCase() !== q.countryCode.toLowerCase()) return false;
  const limits = [a.discoveryPreference?.maxDistanceKm, b.discoveryPreference?.maxDistanceKm]
    .filter((value): value is number => value != null);
  if (!limits.length) return true;
  if (p.locationLat == null || p.locationLng == null || q.locationLat == null || q.locationLng == null) return false;
  return haversineDistanceKm(Number(p.locationLat), Number(p.locationLng), Number(q.locationLat), Number(q.locationLng))
    <= Math.min(...limits);
}

export function acceptsIntent(viewer: SocialUser, other: SocialUser, intent: string): boolean {
  if (isSocialIntent(intent)) return true;
  return viewer.intents.some((item) => item.intent === intent) && acceptsDatingPreferences(viewer, other);
}

export function acceptsDatingPreferences(viewer: SocialUser, other: SocialUser): boolean {
  const prefs = viewer.discoveryPreference;
  const birth = other.profile?.dateOfBirth;
  return !!birth &&
    genderPreferenceMatches(prefs?.preferredGenders ?? [], other.profile?.gender) &&
    (!prefs?.minAge || ageInYears(birth) >= prefs.minAge) &&
    (!prefs?.maxAge || ageInYears(birth) <= prefs.maxAge);
}

export function unavailable(): never {
  throw new AppException(404, ERROR_CODES.RESOURCE_NOT_FOUND, "This resource is unavailable");
}

export function conflict(message: string): never {
  throw new AppException(409, ERROR_CODES.VALIDATION_FAILED, message);
}
