import { type Href, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback } from "react";
import { useSafeBack } from "../../navigation/useSafeBack";
import {
  resolveProfileSectionDestination,
  resolveProfileSectionReturnRoute,
} from "./profileSectionRouting";

export const useProfileSectionFlow = (onboardingNext: Href) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    returnTo?: string | string[];
  }>();
  const editMode =
    pathname.startsWith("/settings/profile/") ||
    (Array.isArray(params.mode) ? params.mode[0] : params.mode) === "edit";
  const returnTo = resolveProfileSectionReturnRoute(params.returnTo);
  const goBack = useSafeBack(returnTo);

  const complete = useCallback(() => {
    if (editMode) {
      goBack();
      return;
    }
    const destination = resolveProfileSectionDestination({
      editMode,
      returnTo,
      onboardingNext,
    });
    router[destination.method](destination.href);
  }, [editMode, goBack, onboardingNext, returnTo, router]);

  return {
    editMode,
    goBack,
    complete,
    primaryLabel: editMode ? "Save changes" : "Continue",
    stepLabel: editMode ? "EDIT PROFILE" : undefined,
  };
};
