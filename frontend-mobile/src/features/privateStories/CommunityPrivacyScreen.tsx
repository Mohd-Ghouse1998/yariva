import React, { useCallback, useState } from "react";
import { AppState, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { communityLabels, privateStoriesApi, type CommunityLabel, type CommunityPreferences } from "../../api/endpoints/privateStories";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NavigationListRow } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";
import { useResponsiveLayout } from "../../theme/responsive";
import { useLocalization } from "../../localization/LocalizationContext";

const empty: CommunityPreferences = { identifyAs: [], connectWith: [], optedInCommunities: [], selfDescription: null };
type Key = "identifyAs" | "connectWith" | "optedInCommunities";
export function CommunityPrivacyScreen() {
  const router = useRouter(); const { palette } = useTheme(); const layout = useResponsiveLayout();
  const { t } = useLocalization();
  const [value, setValue] = useState<CommunityPreferences>(empty); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [loadFailed, setLoadFailed] = useState(false); const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry;
    let active = true;
    let version = 0;
    const clear = () => { version++; setValue(empty); setLoading(true); setError(null); };
    const load = async () => {
      clear();
      if (AppState.currentState !== "active") return;
      const request = version;
      try {
        const choices = await privateStoriesApi.community();
        if (!active || request !== version) return;
        setValue(choices); setLoadFailed(false);
      } catch {
        if (!active || request !== version) return;
        setLoadFailed(true); setError(t("story.community.loadError"));
      } finally { if (active && request === version) setLoading(false); }
    };
    void load();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void load(); else clear(); });
    return () => { active = false; listener.remove(); clear(); };
  }, [retry, t]));
  const toggle = (key: Key, label: CommunityLabel) => setValue(current => ({ ...current, [key]: current[key].includes(label) ? current[key].filter(item => item !== label) : [...current[key], label] }));
  const save = async () => { if (loading || loadFailed || busy) return; setBusy(true); try { await privateStoriesApi.saveCommunity(value); router.back(); } catch { setError(t("story.community.saveError")); } finally { setBusy(false); } };
  const sections: { key: Key; title: string; help: string }[] = [
    { key: "identifyAs", title: t("story.community.identify"), help: t("story.community.identifyHelp") },
    { key: "connectWith", title: t("story.community.connect"), help: t("story.community.connectHelp") },
    { key: "optedInCommunities", title: t("story.community.optIn"), help: t("story.community.optInHelp") },
  ];
  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: palette.background }}><ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingBottom: 32, gap: 16, maxWidth: layout.contentMaxWidth, width: "100%", alignSelf: "center" }}>
    <Button label={t("story.community.back")} variant="ghost" onPress={() => router.back()} />
    <Text variant="title">{t("story.community.title")}</Text>
    <Text color="textSubdued">{t("story.community.help")}</Text>
    {loading ? <Text>{t("story.community.loading")}</Text> : null}
    {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
    {loadFailed ? <Button label={t("story.community.retry")} variant="secondary" onPress={() => setRetry(value => value + 1)} /> : null}
    {sections.map(section => <View key={section.key} style={{ gap: 6 }}><Text variant="heading">{section.title}</Text><Text variant="caption" color="textSubdued">{section.help}</Text>
      {communityLabels.map(item => <NavigationListRow key={item.value} label={t(`story.community.label.${item.value}`)} selected={value[section.key].includes(item.value)} selectionRole="checkbox" onPress={() => { if (!loading && !loadFailed && !busy) toggle(section.key, item.value); }} />)}
    </View>)}
    {value.identifyAs.includes("SELF_DESCRIBE") ? <Input label={t("story.community.describe")} editable={!busy} value={value.selfDescription ?? ""} maxLength={120} onChangeText={selfDescription => setValue(current => ({ ...current, selfDescription }))} /> : null}
    <Button label={t("story.community.save")} loading={busy} disabled={loading || busy || loadFailed} onPress={() => void save()} />
  </ScrollView></SafeAreaView>;
}
