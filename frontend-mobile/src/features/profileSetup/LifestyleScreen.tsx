import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { type IconName } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import type { LifestyleDto } from "../../types/profile";
import {
  DIET_PREFERENCE,
  DRINKING_HABIT,
  EXERCISE_HABIT,
  PET_PREFERENCE,
  SLEEP_PATTERN,
  SMOKING_HABIT,
  SOCIAL_ENERGY_LEVEL,
} from "../../types/enums";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenLifestyle.
// 7 rows with icon tile + label + current value + chevron. Tapping a row
// opens a bottom sheet with the available options.
type Row = {
  key: keyof LifestyleDto;
  label: string;
  icon: IconName;
  options: readonly string[];
};

const ROWS: Row[] = [
  { key: "smoking", label: "Smoking", icon: "cigarette", options: SMOKING_HABIT },
  { key: "drinking", label: "Drinking", icon: "wine", options: DRINKING_HABIT },
  { key: "exercise", label: "Exercise", icon: "dumbbell", options: EXERCISE_HABIT },
  { key: "diet", label: "Diet", icon: "leaf", options: DIET_PREFERENCE },
  { key: "petPreference", label: "Pets", icon: "paw", options: PET_PREFERENCE },
  { key: "sleepPattern", label: "Sleep", icon: "moon", options: SLEEP_PATTERN },
  { key: "socialEnergy", label: "Social energy", icon: "bolt", options: SOCIAL_ENERGY_LEVEL },
];

const empty: LifestyleDto = {
  smoking: null,
  drinking: null,
  exercise: null,
  diet: null,
  petPreference: null,
  sleepPattern: null,
  socialEnergy: null,
};

const fmt = (s: string): string =>
  s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase());

export const LifestyleScreen: React.FC = () => {
  const { palette } = useTheme();
  const toast = useToast();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/schedule");
  const hydration = useProfileHydration();
  const [value, setValue] = useState<LifestyleDto>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [editingKey, setEditingKey] = useState<keyof LifestyleDto | null>(null);

  useEffect(() => {
    if (hydration.profile) setValue(hydration.profile.lifestyle);
  }, [hydration.profile]);

  const onContinue = async () => {
    setSubmitting(true);
    try {
      await profilesApi.setLifestyle(value);
      flow.complete();
    } catch {
      toast.show("Couldn’t save. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const editingRow = useMemo(() => ROWS.find((r) => r.key === editingKey) ?? null, [editingKey]);

  if (hydration.loading || hydration.error || !hydration.profile) {
    return (
      <ProfileSectionLoadState
        title={flow.editMode ? "Lifestyle" : "Lifestyle"}
        subtitle={flow.editMode ? "Lifestyle" : "Optional, but it helps us match better."}
        step={flow.editMode ? undefined : 5}
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
          step={flow.editMode ? undefined : 5}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Lifestyle" : "Lifestyle"}
          subtitle={flow.editMode ? "Lifestyle" : "Optional, but it helps us match better."}
          onBack={flow.goBack}
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={formLayout.content}>
          <NavigationListSection>
            {ROWS.map((r, index) => {
              const v = value[r.key];
              return (
                <NavigationListRow
                  key={r.key}
                  first={index === 0}
                  icon={r.icon}
                  label={r.label}
                  value={v ? fmt(String(v)) : "Not set"}
                  onPress={() => setEditingKey(r.key)}
                />
              );
            })}
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

      <CenterDialog
        visible={editingRow !== null}
        onClose={() => setEditingKey(null)}
        accessibilityLabel={editingRow?.label ?? "Lifestyle"}
      >
        {editingRow ? (
          <>
            <Text variant="subheading" style={{ marginBottom: 12 }}>
              {editingRow.label}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {editingRow.options.map((opt) => (
                <Chip
                  key={opt}
                  label={fmt(opt)}
                  selected={value[editingRow.key] === opt}
                  onPress={() => {
                    setValue(
                      (s) =>
                        ({
                          ...s,
                          [editingRow.key]: value[editingRow.key] === opt ? null : opt,
                        }) as LifestyleDto,
                    );
                    setEditingKey(null);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}
      </CenterDialog>
    </View>
  );
};
