import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { communityLabels, privateStoriesApi, type CommunityLabel, type CommunityPreferences } from "../../api/endpoints/privateStories";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { NavigationListRow } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";
import { useResponsiveLayout } from "../../theme/responsive";

const empty: CommunityPreferences = { identifyAs: [], connectWith: [], optedInCommunities: [], selfDescription: null };
type Key = "identifyAs" | "connectWith" | "optedInCommunities";
export function CommunityPrivacyScreen() {
  const router = useRouter(); const { palette } = useTheme(); const layout = useResponsiveLayout();
  const [value, setValue] = useState<CommunityPreferences>(empty); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [loadFailed, setLoadFailed] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setValue(await privateStoriesApi.community()); setLoadFailed(false); setError(null); } catch { setLoadFailed(true); setError("Couldn’t load private choices."); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const toggle = (key: Key, label: CommunityLabel) => setValue(current => ({ ...current, [key]: current[key].includes(label) ? current[key].filter(item => item !== label) : [...current[key], label] }));
  const save = async () => { if (loading || loadFailed) return; setBusy(true); try { await privateStoriesApi.saveCommunity(value); router.back(); } catch { setError("Couldn’t save. Try again."); } finally { setBusy(false); } };
  const sections: { key: Key; title: string; help: string }[] = [
    { key: "identifyAs", title: "How I identify", help: "Optional and private. This does not change gender or discovery settings." },
    { key: "connectWith", title: "Communities I want to connect with", help: "Interests are separate from how you identify. They do not grant Story access." },
    { key: "optedInCommunities", title: "Private Story community opt-in", help: "Self-described, not verified. Approved connections may include you in a Story narrowed to these communities. Clear a choice to leave it." },
  ];
  return <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: palette.background }}><ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingBottom: 32, gap: 16, maxWidth: layout.contentMaxWidth, width: "100%", alignSelf: "center" }}>
    <Button label="Back" variant="ghost" onPress={() => router.back()} />
    <Text variant="title">Identity and community privacy</Text>
    <Text color="textSubdued">All choices are optional, editable, and private by default. No choice automatically shares your Stories.</Text>
    {loading ? <Text>Loading private choices…</Text> : null}
    {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
    {loadFailed ? <Button label="Try loading again" variant="secondary" onPress={() => void load()} /> : null}
    {sections.map(section => <View key={section.key} style={{ gap: 6 }}><Text variant="heading">{section.title}</Text><Text variant="caption" color="textSubdued">{section.help}</Text>
      {communityLabels.map(item => <NavigationListRow key={item.value} label={item.label} selected={value[section.key].includes(item.value)} selectionRole="checkbox" onPress={() => { if (!loading && !loadFailed) toggle(section.key, item.value); }} />)}
    </View>)}
    {value.identifyAs.includes("SELF_DESCRIBE") ? <Input label="Describe in your own words" value={value.selfDescription ?? ""} maxLength={120} onChangeText={selfDescription => setValue(current => ({ ...current, selfDescription }))} /> : null}
    <Button label="Save private choices" loading={busy} disabled={loading || busy || loadFailed} onPress={() => void save()} />
  </ScrollView></SafeAreaView>;
}
