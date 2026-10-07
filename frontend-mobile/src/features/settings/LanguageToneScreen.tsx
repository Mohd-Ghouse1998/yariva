import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../../components/layout/Header";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useLocalization, type AppLanguage } from "../../localization/LocalizationContext";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useTheme } from "../../theme/ThemeContext";

const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; labelKey: string }> = [
  { value: "en", labelKey: "settings.language.english" },
  { value: "hi", labelKey: "settings.language.hindi" },
  { value: "te", labelKey: "settings.language.telugu" },
];

export const LanguageToneScreen: React.FC = () => {
  const goBack = useSafeBack("/(app)/settings");
  const { palette } = useTheme();
  const layout = useProfileFormLayout();
  const { language, tone, setLanguage, setTone, t } = useLocalization();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header title={t("settings.language.title")} showBack onLeftPress={goBack} />
        <ScrollView contentContainerStyle={layout.content}>
          <NavigationListSection label={t("settings.language.interface")}>
            {LANGUAGE_OPTIONS.map((option, index) => (
              <NavigationListRow
                key={option.value}
                first={index === 0}
                icon="globe"
                label={t(option.labelKey)}
                selected={language === option.value}
                onPress={() => setLanguage(option.value)}
              />
            ))}
          </NavigationListSection>

          <NavigationListSection label="Tone">
            <ToggleRow
              grouped
              first
              label={t("settings.tone.title")}
              sub={t("settings.tone.body")}
              value={tone === "hyderabad-casual"}
              onValueChange={(enabled) => setTone(enabled ? "hyderabad-casual" : "standard")}
            />
          </NavigationListSection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
