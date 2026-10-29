import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useAuth } from "../../auth/AuthContext";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { RangeSlider, SingleSlider } from "../../components/ui/RangeSlider";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { NavigationListSection } from "../../components/ui/NavigationList";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import { PROFILE_GENDER, type ConnectionIntent, type ProfileGender } from "../../types/enums";
import type { UpdateDiscoveryPreferenceRequest } from "../../types/profile";
import { DISCOVERY_DEFAULTS, DISCOVERY_LIMITS } from "../../config/discoveryPreferences";
import { CONNECTION_INTENT_OPTIONS } from "../../config/connectionIntents";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

// Mirrors aroha_ui_deisgn_files/profile-setup.jsx > ScreenDiscoveryPrefs.
// Range slider for age, single slider for distance, gender chips, intent
// chips, two toggles (same-city, recently-active).
const empty: UpdateDiscoveryPreferenceRequest = {
  minAge: DISCOVERY_DEFAULTS.minimumAge,
  maxAge: DISCOVERY_DEFAULTS.maximumAge,
  maxDistanceKm: DISCOVERY_DEFAULTS.distanceKm,
  intentFilter: [],
  preferredGenders: [],
  includeRecentlyActiveOnly: true,
  preferSameCity: false,
};

const GENDER_LABELS: Record<ProfileGender, string> = {
  WOMAN: "Women",
  MAN: "Men",
  NON_BINARY: "Non-binary",
  TRANS_WOMAN: "Trans women",
  TRANS_MAN: "Trans men",
  AGENDER: "Agender",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

export const DiscoveryPreferencesScreen: React.FC = () => {
  const { palette } = useTheme();
  const toast = useToast();
  const { setProfileCompletion } = useAuth();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/communication-preferences");
  const hydration = useProfileHydration();
  const [value, setValue] = useState<UpdateDiscoveryPreferenceRequest>(empty);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hydration.profile) return;
    const preference = hydration.profile.discoveryPreference;
    setValue({
      ...preference,
      minAge: preference.minAge ?? DISCOVERY_DEFAULTS.minimumAge,
      maxAge: preference.maxAge ?? DISCOVERY_DEFAULTS.maximumAge,
      maxDistanceKm: preference.maxDistanceKm ?? DISCOVERY_DEFAULTS.distanceKm,
      intentFilter: preference.intentFilter,
      preferredGenders: preference.preferredGenders,
      includeRecentlyActiveOnly: preference.includeRecentlyActiveOnly,
      preferSameCity: preference.preferSameCity,
    });
  }, [hydration.profile]);

  const toggleGender = (g: ProfileGender) =>
    setValue((s) => ({
      ...s,
      preferredGenders: s.preferredGenders.includes(g)
        ? s.preferredGenders.filter((x) => x !== g)
        : [...s.preferredGenders, g],
    }));
  const toggleIntent = (i: ConnectionIntent) =>
    setValue((s) => ({
      ...s,
      intentFilter: s.intentFilter.length === CONNECTION_INTENT_OPTIONS.length
        ? [i]
        : s.intentFilter.includes(i)
          ? s.intentFilter.filter((x) => x !== i)
          : [...s.intentFilter, i],
    }));

  const onContinue = async () => {
    if (value.minAge < DISCOVERY_LIMITS.minimumAge || value.maxAge < value.minAge) {
      toast.show("Age range must start at 18.", "warning");
      return;
    }
    if (value.maxDistanceKm < DISCOVERY_LIMITS.minimumDistanceKm) {
      toast.show("Distance must be at least 1 km.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await profilesApi.setDiscovery(value);
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
        title={flow.editMode ? "Discovery preferences" : "Who you’re hoping to meet"}
        subtitle={flow.editMode ? "Discovery preferences" : "You can change this any time."}
        step={flow.editMode ? undefined : 7}
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
          step={flow.editMode ? undefined : 7}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Discovery preferences" : "Who you’re hoping to meet"}
          subtitle={flow.editMode ? "Discovery preferences" : "You can change this any time."}
          onBack={flow.goBack}
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={formLayout.content}>
          {/* Age range */}
          <View>
            <View style={styles.headerRow}>
              <Text variant="bodyStrong" style={{ fontSize: 13 }}>
                Age
              </Text>
              <Text variant="caption" color="textSubdued">
                {value.minAge ?? DISCOVERY_LIMITS.minimumAge} –{" "}
                {value.maxAge ?? DISCOVERY_DEFAULTS.maximumAge}
              </Text>
            </View>
            <RangeSlider
              min={DISCOVERY_LIMITS.minimumAge}
              max={DISCOVERY_LIMITS.maximumAge}
              value={[
                value.minAge ?? DISCOVERY_LIMITS.minimumAge,
                value.maxAge ?? DISCOVERY_DEFAULTS.maximumAge,
              ]}
              onChange={([lo, hi]) => setValue((s) => ({ ...s, minAge: lo, maxAge: hi }))}
            />
          </View>

          {/* Distance */}
          <View>
            <View style={styles.headerRow}>
              <Text variant="bodyStrong" style={{ fontSize: 13 }}>
                Distance
              </Text>
              <Text variant="caption" color="textSubdued">
                within {value.maxDistanceKm ?? 25} km
              </Text>
            </View>
            <SingleSlider
              min={DISCOVERY_LIMITS.minimumDistanceKm}
              max={DISCOVERY_LIMITS.maximumDistanceKm}
              value={value.maxDistanceKm ?? DISCOVERY_DEFAULTS.distanceKm}
              onChange={(v) => setValue((s) => ({ ...s, maxDistanceKm: v }))}
            />
          </View>

          {/* Gender */}
          <View>
            <Text variant="bodyStrong" style={{ fontSize: 13, marginBottom: 8 }}>
              Show me
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Chip
                label="All"
                selected={value.preferredGenders.length === 0}
                onPress={() => setValue((s) => ({ ...s, preferredGenders: [] }))}
                size="sm"
              />
              {PROFILE_GENDER.map((g) => (
                <Chip
                  key={g}
                  label={GENDER_LABELS[g]}
                  selected={value.preferredGenders.includes(g)}
                  onPress={() => toggleGender(g)}
                  size="sm"
                />
              ))}
            </View>
          </View>

          {/* Intents */}
          <View>
            <Text variant="bodyStrong" style={{ fontSize: 13, marginBottom: 8 }}>
              People looking for
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Chip
                label="All"
                selected={value.intentFilter.length === CONNECTION_INTENT_OPTIONS.length}
                onPress={() => setValue((s) => ({
                  ...s,
                  intentFilter: CONNECTION_INTENT_OPTIONS.map((option) => option.value),
                }))}
                size="sm"
              />
              {CONNECTION_INTENT_OPTIONS.map(({ value: i, label }) => {
                const active = value.intentFilter.length < CONNECTION_INTENT_OPTIONS.length &&
                  value.intentFilter.includes(i);
                return (
                  <Chip
                    key={i}
                    label={label}
                    selected={active}
                    onPress={() => toggleIntent(i)}
                    size="sm"
                  />
                );
              })}
            </View>
          </View>

          <NavigationListSection>
            <ToggleRow
              grouped
              first
              label="Prefer same city"
              sub="Prioritize people who live in your city."
              value={value.preferSameCity}
              onValueChange={(v) => setValue((s) => ({ ...s, preferSameCity: v }))}
            />
            <ToggleRow
              grouped
              label="Recently active only"
              sub="People active in the past 7 days."
              value={value.includeRecentlyActiveOnly}
              onValueChange={(v) => setValue((s) => ({ ...s, includeRecentlyActiveOnly: v }))}
            />
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

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
});
