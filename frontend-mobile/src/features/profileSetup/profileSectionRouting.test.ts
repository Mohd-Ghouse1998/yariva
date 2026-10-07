import { describe, expect, it } from "vitest";
import {
  PROFILE_REVIEW_ROUTE,
  PROFILE_EDITOR_ROUTE,
  createProfileSectionEditHref,
  PROFILE_TAB_ROUTE,
  resolveProfileSectionDestination,
  resolveProfileSectionReturnRoute,
} from "./profileSectionRouting";

describe("profile section routing", () => {
  it("returns profile for missing or untrusted return paths", () => {
    expect(resolveProfileSectionReturnRoute(undefined)).toBe(PROFILE_TAB_ROUTE);
    expect(resolveProfileSectionReturnRoute("https://example.com")).toBe(PROFILE_TAB_ROUTE);
    expect(resolveProfileSectionReturnRoute("/(auth)/login")).toBe(PROFILE_TAB_ROUTE);
  });

  it("accepts only known in-app edit callers", () => {
    expect(resolveProfileSectionReturnRoute(PROFILE_EDITOR_ROUTE)).toBe(PROFILE_EDITOR_ROUTE);
    expect(resolveProfileSectionReturnRoute(PROFILE_REVIEW_ROUTE)).toBe(PROFILE_REVIEW_ROUTE);
    expect(resolveProfileSectionReturnRoute([PROFILE_TAB_ROUTE])).toBe(PROFILE_TAB_ROUTE);
  });
  it("uses the canonical editors and one communication settings owner", () => {
    expect(
      createProfileSectionEditHref("/(onboarding)/photos", PROFILE_EDITOR_ROUTE),
    ).toMatchObject({
      pathname: "/(app)/settings/profile/photos",
      params: { returnTo: PROFILE_EDITOR_ROUTE, mode: "edit" },
    });
    expect(
      createProfileSectionEditHref("/(onboarding)/communication-preferences", PROFILE_REVIEW_ROUTE),
    ).toMatchObject({ pathname: "/(app)/settings/communication" });
  });

  it("replaces the caller in edit mode instead of continuing onboarding", () => {
    expect(
      resolveProfileSectionDestination({
        editMode: true,
        returnTo: PROFILE_REVIEW_ROUTE,
        onboardingNext: "/(onboarding)/schedule",
      }),
    ).toEqual({ method: "replace", href: PROFILE_REVIEW_ROUTE });
  });

  it("continues to the next step during onboarding", () => {
    expect(
      resolveProfileSectionDestination({
        editMode: false,
        returnTo: PROFILE_TAB_ROUTE,
        onboardingNext: "/(onboarding)/schedule",
      }),
    ).toEqual({ method: "push", href: "/(onboarding)/schedule" });
  });
});
