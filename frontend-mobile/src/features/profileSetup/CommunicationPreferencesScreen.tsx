import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useAuth } from "../../auth/AuthContext";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import type { CommunicationPreferenceDto } from "../../types/profile";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenCommPrefs.
const defaults: CommunicationPreferenceDto = {
  allowVoiceCalls: true,
  allowVideoCalls: false,
  allowPushMatches: true,
  allowPushMessages: true,
  allowPushSocial: false,
  allowPushCalls: true,
  allowReadReceipts: true,
};

export const CommunicationPreferencesScreen: React.FC = () => {
  const { palette } = useTheme();
  const toast = useToast();
  const { setProfileCompletion } = useAuth();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/photos");
  const hydration = useProfileHydration();
  const [value, setValue] = useState<CommunicationPreferenceDto>(defaults);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hydration.profile) setValue(hydration.profile.communicationPreference);
  }, [hydration.profile]);

  const onContinue = async () => {
    setSubmitting(true);
    try {
      await profilesApi.setCommunication(value);
      const me = await profilesApi.me();
      setProfileCompletion(me.completion);
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
        title={flow.editMode ? "Communication" : "How people can reach you"}
        subtitle={flow.editMode ? "Communication" : "You’re in control of who can call you, always."}
        step={flow.editMode ? undefined : 8}
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
          step={flow.editMode ? undefined : 8}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Communication" : "How people can reach you"}
          subtitle={flow.editMode ? "Communication" : "You’re in control of who can call you, always."}
          onBack={flow.goBack}
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={formLayout.content}
        >
          <ToggleRow
            label="Allow voice calls"
            sub="Only people you’ve matched with."
            value={value.allowVoiceCalls}
            onValueChange={(v) => setValue((s) => ({ ...s, allowVoiceCalls: v }))}
          />
          <ToggleRow
            label="Allow video calls"
            sub="Off by default. You can turn this on per chat."
            value={value.allowVideoCalls}
            onValueChange={(v) => setValue((s) => ({ ...s, allowVideoCalls: v }))}
          />
          <ToggleRow
            label="Read receipts"
            sub="Let people see when you’ve read their message."
            value={value.allowReadReceipts}
            onValueChange={(v) => setValue((s) => ({ ...s, allowReadReceipts: v }))}
          />
          <ToggleRow
            label="Push: new matches"
            value={value.allowPushMatches}
            onValueChange={(v) => setValue((s) => ({ ...s, allowPushMatches: v }))}
          />
          <ToggleRow
            label="Push: new messages"
            value={value.allowPushMessages}
            onValueChange={(v) => setValue((s) => ({ ...s, allowPushMessages: v }))}
          />
          <ToggleRow
            label="Push: incoming calls"
            value={value.allowPushCalls}
            onValueChange={(v) => setValue((s) => ({ ...s, allowPushCalls: v }))}
          />
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
      </SafeAreaView>
    </View>
  );
};
