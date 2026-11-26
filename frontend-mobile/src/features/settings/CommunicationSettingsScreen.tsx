import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { Header } from "../../components/layout/Header";
import { NavigationListSection } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useTheme } from "../../theme/ThemeContext";
import type { CommunicationPreferenceDto } from "../../types/profile";
import { SettingsLoadState } from "./SettingsLoadState";
import { useSerializedSettings } from "./useSerializedSettings";
import { syncPushRegistration } from "../../notifications/pushRegistration";
import { useToast } from "../../components/ui/Toast";

const loadCommunication = async () => (await profilesApi.me()).communicationPreference;

const saveCommunication = async (next: CommunicationPreferenceDto) =>
  (await profilesApi.setCommunication(next)).value;

export const CommunicationSettingsScreen: React.FC = () => {
  const formLayout = useProfileFormLayout();
  const goBack = useSafeBack("/(app)/settings");
  const { palette } = useTheme();
  const toast = useToast();
  const settings = useSerializedSettings({
    load: loadCommunication,
    save: saveCommunication,
    saveErrorMessage: "Couldn’t save the communication change.",
  });
  const value = settings.value;

  const updatePush = async (
    field: "allowPushMatches" | "allowPushMessages" | "allowPushCalls" | "allowPushSocial",
    enabled: boolean,
  ) => {
    if (!value) return;
    if (enabled) {
      try {
        const result = await syncPushRegistration(true);
        if (result === "PERMISSION_DENIED") {
          toast.show(
            "Notifications are off in device settings. You can keep using Yariva without them.",
            "info",
          );
          return;
        }
      } catch {
        toast.show("Push registration did not finish. Try again when you’re online.", "error");
        return;
      }
    }
    await settings.update({ ...value, [field]: enabled });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header title="Communication" showBack onLeftPress={goBack} />
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
            <NavigationListSection label="CALLS & RECEIPTS">
              <ToggleRow
                grouped
                first
                label="Voice calls"
                sub="From your matches"
                value={value.allowVoiceCalls}
                disabled={settings.saving}
                onValueChange={(allowVoiceCalls) =>
                  void settings.update({ ...value, allowVoiceCalls })
                }
              />
              <ToggleRow
                grouped
                label="Video calls"

                value={value.allowVideoCalls}
                disabled={settings.saving}
                onValueChange={(allowVideoCalls) =>
                  void settings.update({ ...value, allowVideoCalls })
                }
              />
              <ToggleRow
                grouped
                label="Read receipts"

                value={value.allowReadReceipts}
                disabled={settings.saving}
                onValueChange={(allowReadReceipts) =>
                  void settings.update({ ...value, allowReadReceipts })
                }
              />
            </NavigationListSection>

            <NavigationListSection label="NOTIFICATIONS">
              <ToggleRow
                grouped
                first
                label="New matches"
                value={value.allowPushMatches}
                disabled={settings.saving}
                onValueChange={(allowPushMatches) =>
                  void updatePush("allowPushMatches", allowPushMatches)
                }
              />
              <ToggleRow
                grouped
                label="New messages"
                value={value.allowPushMessages}
                disabled={settings.saving}
                onValueChange={(allowPushMessages) =>
                  void updatePush("allowPushMessages", allowPushMessages)
                }
              />
              <ToggleRow
                grouped
                label="Circles and check-ins"
                value={value.allowPushSocial ?? false}
                disabled={settings.saving}
                onValueChange={(enabled) => void updatePush("allowPushSocial", enabled)}
              />
              <ToggleRow
                grouped
                label="Incoming calls"
                value={value.allowPushCalls}
                disabled={settings.saving}
                onValueChange={(allowPushCalls) =>
                  void updatePush("allowPushCalls", allowPushCalls)
                }
              />
            </NavigationListSection>
            {settings.saving ? (
              <Text variant="caption" color="textSubdued" accessibilityLiveRegion="polite">
                Saving…
              </Text>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};
