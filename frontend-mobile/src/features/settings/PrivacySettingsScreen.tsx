import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { Header } from "../../components/layout/Header";
import { Chip } from "../../components/ui/Chip";
import { NavigationListSection } from "../../components/ui/NavigationList";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useTheme } from "../../theme/ThemeContext";
import {
  privacySettingsToProfileUpdate,
  profileToPrivacySettings,
  type VisibilityMode,
} from "./privacySettings";
import { SettingsLoadState } from "./SettingsLoadState";
import { useSerializedSettings } from "./useSerializedSettings";

const loadPrivacy = async () => profileToPrivacySettings(await profilesApi.me());

const savePrivacy = async (next: Awaited<ReturnType<typeof loadPrivacy>>) =>
  profileToPrivacySettings(await profilesApi.updateMe(privacySettingsToProfileUpdate(next)));

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
            <SectionTitle style={{ marginTop: 8 }}>PROFILE VISIBILITY</SectionTitle>
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
                sub="Only people you mark Interested can see you."
                value={value.isIncognito}
                disabled={settings.saving}
                onValueChange={(isIncognito) => void settings.update({ ...value, isIncognito })}
              />
            </NavigationListSection>

            <NavigationListSection label="PROFILE DETAILS">
              <ToggleRow
                grouped
                first
                label="Hide age"
                sub="People can still match by age range."
                value={value.hideAge}
                disabled={settings.saving}
                onValueChange={(hideAge) => void settings.update({ ...value, hideAge })}
              />
              <ToggleRow
                grouped
                label="Hide distance"
                sub="Show only city, not kilometres away."
                value={value.hideDistance}
                disabled={settings.saving}
                onValueChange={(hideDistance) => void settings.update({ ...value, hideDistance })}
              />
              <ToggleRow
                grouped
                label="Share personal values"
                sub="Family, religion and future plans"
                value={value.shareSensitiveCompatibility}
                disabled={settings.saving}
                onValueChange={(shareSensitiveCompatibility) =>
                  void settings.update({ ...value, shareSensitiveCompatibility })
                }
              />
            </NavigationListSection>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};
