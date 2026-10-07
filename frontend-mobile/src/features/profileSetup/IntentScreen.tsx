import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usersApi } from "../../api/endpoints/users";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useAuth } from "../../auth/AuthContext";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { CONNECTION_INTENT_OPTIONS, normalizeConnectionIntents } from "../../config/connectionIntents";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import type { ConnectionIntent } from "../../types/enums";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

export const IntentScreen: React.FC = () => {
  const { palette } = useTheme();
  const toast = useToast();
  const { setProfileCompletion } = useAuth();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/interests");
  const hydration = useProfileHydration();
  const [selected, setSelected] = useState<Set<ConnectionIntent>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hydration.profile) return;
    setSelected(new Set(normalizeConnectionIntents(hydration.profile.intents)));
  }, [hydration.profile]);

  const toggle = (i: ConnectionIntent) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const onContinue = async () => {
    if (selected.size === 0) {
      toast.show("Pick at least one.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const response = await usersApi.setIntents(Array.from(selected));
      setProfileCompletion(response.profileCompletion);
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
        title={flow.editMode ? "Looking for" : "What brings you here?"}
        subtitle={
          flow.editMode ? "Looking for" : "Choose what feels right for you."
        }
        step={flow.editMode ? undefined : 3}
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
          step={flow.editMode ? undefined : 3}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Looking for" : "What brings you here?"}
          subtitle={
            flow.editMode ? "Looking for" : "Choose what feels right for you."
          }
          onBack={flow.goBack}
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={formLayout.content}>
          <NavigationListSection>
            {CONNECTION_INTENT_OPTIONS.map((it, index) => (
              <NavigationListRow
                key={it.value}
                first={index === 0}
                icon="heart"
                label={it.label}
                selected={selected.has(it.value)}
                selectionRole="checkbox"
                disabled={submitting}
                onPress={() => toggle(it.value)}
              />
            ))}
          </NavigationListSection>
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
