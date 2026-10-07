import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useAuth } from "../../auth/AuthContext";
import { ArohaMark } from "../../components/ui/ArohaMark";
import { Button } from "../../components/ui/Button";
import { CompletionRing } from "../../components/profile/CompletionRing";
import { Icon, type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { shadows } from "../../theme/shadows";
import type { ProfileCompletionStatusDto } from "../../types/auth";
import type { ProfileCompletionCriterion } from "../../types/enums";
import { createProfileSectionEditHref, PROFILE_REVIEW_ROUTE } from "./profileSectionRouting";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenCompletion.
// Soft warm bg, percentage ring banner, todo checklist, finish CTA.
const ITEMS: Array<{
  label: string;
  icon: IconName;
  matchedBy: ProfileCompletionCriterion[];
  href?: string;
}> = [
  {
    label: "Basics",
    icon: "user",
    matchedBy: [
      "DISPLAY_NAME",
      "DATE_OF_BIRTH",
      "AGE_18_PLUS",
      "CITY",
      "REGION",
      "COUNTRY_CODE",
      "LOCATION_COORDINATES",
      "LOCATION_GEOHASH",
    ],
    href: "/(onboarding)/basic-info",
  },
  {
    label: "A few words about you",
    icon: "edit",
    matchedBy: ["BIO"],
    href: "/(onboarding)/bio",
  },
  {
    label: "Your intent",
    icon: "heart",
    matchedBy: ["INTENT"],
    href: "/(onboarding)/intent",
  },
  {
    label: "Discovery preferences",
    icon: "spark",
    matchedBy: ["DISCOVERY_PREFERENCE"],
    href: "/(onboarding)/discovery-preferences",
  },
  {
    label: "Communication preferences",
    icon: "shield",
    matchedBy: ["COMMUNICATION_PREFERENCE"],
    href: "/(onboarding)/communication-preferences",
  },
  {
    label: "An approved primary photo",
    icon: "image",
    matchedBy: ["APPROVED_PHOTO", "APPROVED_PRIMARY_PHOTO"],
    href: "/(onboarding)/photos",
  },
];

export const ReviewScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { setProfileCompletion, refreshUser } = useAuth();
  const [status, setStatus] = useState<ProfileCompletionStatusDto | null>(null);
  const [approvedPhotoCount, setApprovedPhotoCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const me = await profilesApi.me();
    setStatus(me.completion);
    setApprovedPhotoCount(
      me.photos.filter((photo) => photo.moderationStatus === "APPROVED").length,
    );
    setProfileCompletion(me.completion);
  }, [setProfileCompletion]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onFinish = async () => {
    if (!status?.isComplete) {
      toast.show("Finish all steps first.", "warning");
      return;
    }
    setBusy(true);
    try {
      await refreshUser();
      router.replace("/(app)/(tabs)/discover");
    } catch {
      toast.show("Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  };

  const totalDone = status
    ? ITEMS.filter((it) => it.matchedBy.every((c) => !status.missingCriteria.includes(c))).length
    : 0;
  const total = ITEMS.length;
  const percent = status?.isComplete ? 100 : Math.round((totalDone / total) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <ArohaMark size={42} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
        >
          <Text variant="title">
            {status?.isComplete ? "You’re all set." : "You’re almost there."}
          </Text>
          <Text variant="body" color="textSubdued" style={{ marginTop: 6 }}>
            {status?.isComplete
              ? approvedPhotoCount > 0
                ? "Your profile is ready to be discovered."
                : "We’ll let you know as soon as your photo review is complete."
              : `${total - totalDone} small step${
                  total - totalDone === 1 ? "" : "s"
                } and Discover unlocks.`}
          </Text>

          <View style={[styles.ringCard, shadows.sm]}>
            <CompletionRing percent={percent} size={64} strokeWidth={6} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" style={{ fontSize: 14, fontWeight: "700" }}>
                Profile completion
              </Text>
              <Text variant="caption" color="textSubdued" style={{ marginTop: 2 }}>
                {totalDone} of {total} done · {total - totalDone} left
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 18, gap: 8 }}>
            {ITEMS.map((it) => {
              const done = it.matchedBy.every((c) => !(status?.missingCriteria ?? []).includes(c));
              return (
                <Pressable
                  key={it.label}
                  style={({ pressed }) => [
                    styles.itemRow,
                    pressed && !done ? styles.itemRowPressed : null,
                  ]}
                  onPress={() => {
                    if (!done && it.href) {
                      router.push(createProfileSectionEditHref(it.href, PROFILE_REVIEW_ROUTE));
                    }
                  }}
                  accessibilityRole={done ? undefined : "button"}
                  accessibilityLabel={done ? `${it.label}, complete` : `Complete ${it.label}`}
                  accessibilityState={{ disabled: done }}
                  disabled={done}
                >
                  <View
                    style={[
                      styles.checkCircle,
                      {
                        backgroundColor: done ? palette.success : palette.surface,
                        borderColor: done ? palette.transparent : palette.borderStrong,
                        borderWidth: done ? 0 : 1.5,
                      },
                    ]}
                  >
                    {done ? (
                      <Icon name="check" size={16} color={palette.alwaysWhite} strokeWidth={2.5} />
                    ) : null}
                  </View>
                  <Text
                    variant="bodyStrong"
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: "500",
                      color: done ? palette.textSecondary : palette.textPrimary,
                    }}
                  >
                    {it.label}
                  </Text>
                  {!done ? (
                    <Icon name="chevronRight" size={18} color={palette.textSubdued} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <ScreenFooter safeAreaHandled>
          <Button
            label={status?.isComplete ? "Enter Yariva" : "Finish profile"}
            variant="primary"
            fullWidth
            loading={busy}
            onPress={onFinish}
          />
        </ScreenFooter>
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  ringCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 22,
    backgroundColor: palette.surface,
    marginTop: 24,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  itemRowPressed: {
    opacity: 0.76,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
}));
