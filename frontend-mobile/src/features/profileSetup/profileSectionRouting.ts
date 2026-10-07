import type { Href } from "expo-router";

export const PROFILE_TAB_ROUTE = "/(app)/(tabs)/profile" as const;
export const PROFILE_REVIEW_ROUTE = "/(onboarding)/review" as const;
export const PROFILE_EDITOR_ROUTE = "/(app)/settings/edit-profile" as const;

export type ProfileSectionReturnRoute =
  typeof PROFILE_TAB_ROUTE | typeof PROFILE_EDITOR_ROUTE | typeof PROFILE_REVIEW_ROUTE;

const ALLOWED_RETURN_ROUTES = new Set<string>([
  PROFILE_TAB_ROUTE,
  PROFILE_EDITOR_ROUTE,
  PROFILE_REVIEW_ROUTE,
]);

export const resolveProfileSectionReturnRoute = (
  value: string | string[] | undefined,
): ProfileSectionReturnRoute => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && ALLOWED_RETURN_ROUTES.has(candidate)
    ? (candidate as ProfileSectionReturnRoute)
    : PROFILE_TAB_ROUTE;
};

export const createProfileSectionEditHref = (
  pathname: string,
  returnTo: ProfileSectionReturnRoute,
): Href =>
  ({
    pathname:
      pathname === "/(onboarding)/communication-preferences"
        ? "/(app)/settings/communication"
        : pathname.startsWith("/(onboarding)/")
          ? pathname.replace("/(onboarding)/", "/(app)/settings/profile/")
          : pathname,
    params: {
      mode: "edit",
      returnTo,
    },
  }) as Href;

export const resolveProfileSectionDestination = ({
  editMode,
  returnTo,
  onboardingNext,
}: {
  editMode: boolean;
  returnTo: string | string[] | undefined;
  onboardingNext: Href;
}): { method: "push" | "replace"; href: Href } =>
  editMode
    ? {
        method: "replace",
        href: resolveProfileSectionReturnRoute(returnTo),
      }
    : { method: "push", href: onboardingNext };
