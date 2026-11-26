import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { Header } from "../../components/layout/Header";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Chip } from "../../components/ui/Chip";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/spacing";
import type { ProfileAudience } from "../../types/profile";
import {
  AUDIENCE_LABELS,
  PERSONAL_DETAIL_FIELDS,
  PROFILE_DETAIL_FIELDS,
  privacySettingsToProfileUpdate,
  profileToPrivacySettings,
  type PrivacySettingsValue,
  type VisibilityMode,
} from "./privacySettings";
import { SettingsLoadState } from "./SettingsLoadState";
import { useSerializedSettings } from "./useSerializedSettings";

const loadPrivacy = async () => profileToPrivacySettings(await profilesApi.me());

const savePrivacy = async (next: PrivacySettingsValue, previous: PrivacySettingsValue) =>
  profileToPrivacySettings(await profilesApi.updateMe(privacySettingsToProfileUpdate(next, previous)));

const AUDIENCE_OPTIONS: ProfileAudience[] = ["ALL_ELIGIBLE", "MATCHES", "ONLY_ME"];

const VISIBILITY_OPTIONS: Array<{
  value: VisibilityMode;
  label: string;
  description: string;
}> = [
  {
    value: "VISIBLE",
    label: "Visible",
    description: "People who fit your preferences can discover you.",
  },
  {
    value: "PAUSED",
    label: "Paused",
    description: "Keep matches and chats, but stop new discovery.",
  },
  {
    value: "HIDDEN",
    label: "Hidden",
    description: "Hide your profile until you return.",
  },
];

export const PrivacySettingsScreen: React.FC = () => {
  const formLayout = useProfileFormLayout();
  const goBack = useSafeBack("/(app)/settings");
  const { palette } = useTheme();
  const [editing, setEditing] = useState<(typeof PROFILE_DETAIL_FIELDS)[number] | null>(null);
  const settings = useSerializedSettings({
    load: loadPrivacy,
    save: savePrivacy,
    saveErrorMessage: "Couldn’t save the privacy change.",
  });
  const value = settings.value;

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header title="Privacy" showBack onLeftPress={goBack} />
        {!value || settings.loading || settings.loadError ? (
          <SettingsLoadState
            loading={settings.loading}
            error={settings.loadError}
            onRetry={() => void settings.reload()}
          />
        ) : (
          <ScrollView
            contentContainerStyle={formLayout.content}
            contentInsetAdjustmentBehavior="automatic"
          >
            <SectionTitle style={{ marginTop: spacing.sm }}>PROFILE VISIBILITY</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={value.visibility === option.value}
                  disabled={settings.saving}
                  onPress={() => void settings.update({ ...value, visibility: option.value })}
                />
              ))}
            </View>
            <Text variant="caption" color="textSubdued" style={{ marginTop: 6 }}>
              {VISIBILITY_OPTIONS.find((option) => option.value === value.visibility)?.description}
              {settings.saving ? " Saving…" : ""}
            </Text>

            <NavigationListSection label="DISCOVERY">
              <ToggleRow
                grouped
                first
                label="Incognito"
                sub="Hidden from Discover. People you mark Interested and active matches can still see you."
                value={value.isIncognito}
                disabled={settings.saving}
                onValueChange={(isIncognito) => void settings.update({ ...value, isIncognito })}
              />
            </NavigationListSection>

            <Text variant="caption" color="textSubdued">
              Choose who can see each detail when they can already view your profile.
            </Text>
            {([
              ["PROFILE DETAILS", PROFILE_DETAIL_FIELDS],
              ["PERSONAL DETAILS", PERSONAL_DETAIL_FIELDS],
            ] as const).map(([label, fields]) => (
              <NavigationListSection key={label} label={label}>
                {fields.map((field, index) => {
                  const audience = AUDIENCE_LABELS[value.fieldAudiences[field.key]];
                  return (
                    <NavigationListRow
                      key={field.key}
                      first={index === 0}
                      label={field.label}
                      meta={field.description}
                      metaLines={2}
                      value={audience}
                      accessibilityLabel={`${field.label}, ${audience}`}
                      disabled={settings.saving}
                      onPress={() => setEditing(field)}
                    />
                  );
                })}
              </NavigationListSection>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
      {value && editing ? (
        <CenterDialog visible onClose={() => setEditing(null)} accessibilityLabel={`${editing.label} audience`}>
          <SectionTitle>{editing.label}</SectionTitle>
          <NavigationListSection>
            {AUDIENCE_OPTIONS.map((audience, index) => (
              <NavigationListRow
                key={audience}
                first={index === 0}
                label={AUDIENCE_LABELS[audience]}
                selected={value.fieldAudiences[editing.key] === audience}
                onPress={() => {
                  setEditing(null);
                  if (value.fieldAudiences[editing.key] !== audience) {
                    void settings.update({
                      ...value,
                      fieldAudiences: { ...value.fieldAudiences, [editing.key]: audience },
                    });
                  }
                }}
              />
            ))}
          </NavigationListSection>
        </CenterDialog>
      ) : null}
    </View>
  );
};
