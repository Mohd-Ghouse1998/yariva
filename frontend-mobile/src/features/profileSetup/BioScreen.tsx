import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useAuth } from "../../auth/AuthContext";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenBio.
export const BioScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { setProfileCompletion } = useAuth();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/intent");
  const hydration = useProfileHydration();

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!hydration.profile) return;
    setHeadline(hydration.profile.headline ?? "");
    setBio(hydration.profile.bio ?? "");
  }, [hydration.profile]);

  const onContinue = async () => {
    setError(null);
    if (bio.trim().length < 20) {
      setError("Your bio should be at least 20 characters.");
      return;
    }
    if (bio.trim().length > 1000) {
      setError("Bio can be at most 1000 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const profile = await profilesApi.updateMe({
        headline: headline.trim() || null,
        bio: bio.trim(),
      });
      setProfileCompletion(profile.completion);
      flow.complete();
    } catch {
      toast.show("Couldn’t save. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (hydration.loading || hydration.error || !hydration.profile) {
    return (
      <ProfileSectionLoadState
        title={flow.editMode ? "Bio & headline" : "A few words about you"}
        subtitle={flow.editMode ? "Bio & headline" : "Honest beats clever. We promise."}
        step={flow.editMode ? undefined : 2}
        total={flow.editMode ? undefined : 9}
        contextLabel={flow.stepLabel}
        loading={hydration.loading}
        error={hydration.error}
        onBack={flow.goBack}
        onRetry={() => void hydration.reload()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <StepHeader
          step={flow.editMode ? undefined : 2}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Bio & headline" : "A few words about you"}
          subtitle={flow.editMode ? "Bio & headline" : "Honest beats clever. We promise."}
          onBack={flow.goBack}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={formLayout.content}
            keyboardShouldPersistTaps="handled"
          >
            <Input
              label="Headline"
              helper={flow.editMode ? undefined : "A short line that captures you."}
              placeholder="Late-night reader, early-morning walker."
              value={headline}
              onChangeText={setHeadline}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 250);
              }}
              maxLength={140}
              multiline
              numberOfLines={2}
              style={{
                minHeight: 48,
                maxHeight: 68,
                paddingVertical: 4,
                textAlignVertical: "center",
              }}
            />
            <Input
              label="About you"
              accessibilityLabel="Bio"
              multiline
              value={bio}
              onChangeText={setBio}
              placeholder="A little about you…"
              maxLength={1000}
              helper={`${bio.length} / 1000 · 20 minimum`}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
              }}
            />

            {!flow.editMode ? (
              <View style={styles.tipCard}>
                <Icon name="sparkle" size={18} color={palette.brandStrong} />
                <Text
                  variant="caption"
                  style={{ flex: 1, color: palette.textBrand, lineHeight: 18 }}
                >
                  <Text variant="captionStrong" style={{ color: palette.textBrand }}>
                    Try:
                  </Text>{" "}
                  “What I’d do on a perfect Saturday…” or “A small thing that made me happy this
                  week.”
                </Text>
              </View>
            ) : null}

            {error ? (
              <Text variant="caption" color="error">
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <ScreenFooter safeAreaHandled>
            <Button
              label={flow.primaryLabel}
              variant="primary"
              fullWidth
              loading={submitting}
              onPress={onContinue}
            />
          </ScreenFooter>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  tipCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: palette.brandSubdued,
  },
}));
