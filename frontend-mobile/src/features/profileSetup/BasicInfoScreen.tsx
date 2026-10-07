import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { profilesApi } from "../../api/endpoints/profiles";
import { ApiError } from "../../api/errors";
import { useAuth } from "../../auth/AuthContext";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Screen } from "../../components/layout/Screen";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/spacing";
import type { ProfileGender } from "../../types/enums";
import { PROFILE_GENDER } from "../../types/enums";
import { ageFromIso, formatDateInput } from "../../utils/format";
import { CITY_PRESETS, captureCurrentLocation, type LocationOutcome } from "../../utils/location";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { validateBasicInfoText } from "./basicInfoValidation";
import { useProfileSectionFlow } from "./useProfileSectionFlow";

const GENDER_LABELS: Record<ProfileGender, string> = {
  WOMAN: "Woman",
  MAN: "Man",
  NON_BINARY: "Non-binary",
  TRANS_WOMAN: "Trans woman",
  TRANS_MAN: "Trans man",
  AGENDER: "Agender",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

interface CapturedLocation {
  latitude: number;
  longitude: number;
  source: "device" | "preset";
  presetLabel?: string;
}

export const BasicInfoScreen: React.FC = () => {
  const { palette } = useTheme();
  const toast = useToast();
  const { setProfileCompletion } = useAuth();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/bio");

  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [gender, setGender] = useState<ProfileGender | null>(null);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [coords, setCoords] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const hydrate = async () => {
    setHydrating(true);
    setHydrationError(null);
    try {
      const me = await profilesApi.me();
      if (me.displayName) setDisplayName(me.displayName);
      if (me.pronouns) setPronouns(me.pronouns);
      if (me.gender) setGender(me.gender);
      if (me.dateOfBirth) {
        const d = new Date(me.dateOfBirth);
        setYear(String(d.getUTCFullYear()));
        setMonth(String(d.getUTCMonth() + 1));
        setDay(String(d.getUTCDate()));
      }
      if (me.city) setCity(me.city);
      if (me.region) setRegion(me.region);
      if (me.countryCode) setCountryCode(me.countryCode);
      if (me.locationLat != null && me.locationLng != null) {
        const matchingPreset = CITY_PRESETS.find(
          (preset) =>
            preset.city.toLowerCase() === me.city?.trim().toLowerCase() &&
            preset.countryCode === me.countryCode?.trim().toUpperCase(),
        );
        setCoords({
          latitude: me.locationLat,
          longitude: me.locationLng,
          source: matchingPreset ? "preset" : "device",
          presetLabel: matchingPreset?.label,
        });
      }
    } catch (cause) {
      if (flow.editMode) {
        setHydrationError(
          cause instanceof Error ? cause.message : "Couldn’t load your saved details.",
        );
      }
    } finally {
      setHydrating(false);
    }
  };

  useEffect(() => {
    void hydrate();
    // Hydration is intentionally tied to the route mode, not mutable form fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.editMode]);

  const invalidateCapturedLocation = () => {
    if (!coords) return;
    setCoords(null);
    setLocationError("Confirm your location again after changing the city or region.");
  };

  const applyCaptured = (outcome: LocationOutcome): void => {
    if (!outcome.ok) {
      setLocationError(outcome.message);
      setCityPickerOpen(true);
      return;
    }
    setLocationError(null);
    setCoords({
      latitude: outcome.latitude,
      longitude: outcome.longitude,
      source: "device",
    });
    if (outcome.city && !city) setCity(outcome.city);
    if (outcome.region && !region) setRegion(outcome.region);
    if (outcome.countryCode && !countryCode) {
      setCountryCode(outcome.countryCode.toUpperCase());
    }
  };

  const onUseLocation = async () => {
    if (locating) return; // Debounce repeated taps.
    setLocating(true);
    setLocationError(null);
    try {
      const outcome = await captureCurrentLocation();
      applyCaptured(outcome);
    } finally {
      setLocating(false);
    }
  };

  const onPickCity = (preset: (typeof CITY_PRESETS)[number]) => {
    setCoords({
      latitude: preset.latitude,
      longitude: preset.longitude,
      source: "preset",
      presetLabel: preset.label,
    });
    setCity(preset.city);
    setRegion(preset.region);
    setCountryCode(preset.countryCode);
    setLocationError(null);
    setCityPickerOpen(false);
  };

  const onContinue = async () => {
    setError(null);
    const textError = validateBasicInfoText({
      displayName,
      pronouns,
      city,
      region,
      countryCode,
    });
    if (textError) {
      setError(textError);
      return;
    }
    const dob = formatDateInput(year, month, day);
    if (!dob) {
      setError("Enter a valid date of birth.");
      return;
    }
    const age = ageFromIso(dob);
    if (age == null || age < 18) {
      setError("You must be 18 or older to use Yariva.");
      return;
    }
    if (!coords) {
      setError("Tap “Use my location” or pick a city so we can show people nearby.");
      return;
    }
    setSubmitting(true);
    try {
      const profile = await profilesApi.updateMe({
        displayName: displayName.trim(),
        pronouns: pronouns.trim() || null,
        gender,
        dateOfBirth: dob,
        city: city.trim(),
        region: region.trim(),
        countryCode: countryCode.trim().toUpperCase(),
        location: {
          lat: coords.latitude,
          lng: coords.longitude,
        },
      });
      setProfileCompletion(profile.completion);
      flow.complete();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else toast.show("Couldn’t save. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const locationLabel = coords
    ? coords.source === "preset"
      ? `Using ${coords.presetLabel}`
      : "Location captured"
    : locating
      ? "Getting your location…"
      : "Use my location";

  if (flow.editMode && (hydrating || hydrationError)) {
    return (
      <ProfileSectionLoadState
        title={flow.editMode ? "Basic details" : "The basics"}
        subtitle={flow.editMode ? "Basic details" : "Keep your core profile details accurate."}
        contextLabel={flow.stepLabel}
        loading={hydrating}
        error={hydrationError}
        onBack={flow.goBack}
        onRetry={() => void hydrate()}
      />
    );
  }

  return (
    <Screen
      scroll
      keyboardAvoiding
      padded={false}
      bottomBar={
        <Button
          label={flow.primaryLabel}
          onPress={onContinue}
          loading={submitting}
          disabled={hydrating}
          fullWidth
        />
      }
    >
      <StepHeader
        step={flow.editMode ? undefined : 1}
        total={flow.editMode ? undefined : 9}
        contextLabel={flow.stepLabel}
        title={flow.editMode ? "Basic details" : "The basics"}
        subtitle={flow.editMode ? "Basic details" : "Just a few details so people can find you."}
        onBack={flow.goBack}
      />
      <View style={formLayout.content}>
        <Input label="Name" value={displayName} onChangeText={setDisplayName} maxLength={80} />
        <Input
          label="Pronouns (optional)"
          placeholder="she/her, he/him, they/them…"
          value={pronouns}
          onChangeText={setPronouns}
          maxLength={80}
        />
        <View>
          <Text variant="captionStrong" color="textSecondary" style={{ marginBottom: spacing.xs }}>
            Gender (optional)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {PROFILE_GENDER.map((g) => (
              <Chip
                key={g}
                label={GENDER_LABELS[g]}
                selected={gender === g}
                onPress={() => setGender(g === gender ? null : g)}
              />
            ))}
          </View>
        </View>
        <View>
          <Text variant="captionStrong" color="textSecondary" style={{ marginBottom: spacing.xs }}>
            Date of birth
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Input
              placeholder="DD"
              keyboardType="number-pad"
              maxLength={2}
              value={day}
              onChangeText={setDay}
              containerStyle={{ flex: 1 }}
            />
            <Input
              placeholder="MM"
              keyboardType="number-pad"
              maxLength={2}
              value={month}
              onChangeText={setMonth}
              containerStyle={{ flex: 1 }}
            />
            <Input
              placeholder="YYYY"
              keyboardType="number-pad"
              maxLength={4}
              value={year}
              onChangeText={setYear}
              containerStyle={{ flex: 1.4 }}
            />
          </View>
        </View>
        <Input
          label="City"
          maxLength={120}
          value={city}
          onChangeText={(value) => {
            invalidateCapturedLocation();
            setCity(value);
          }}
        />
        <Input
          label="Region / State"
          maxLength={120}
          value={region}
          onChangeText={(value) => {
            invalidateCapturedLocation();
            setRegion(value);
          }}
        />
        <Input
          label="Country code (2 letters)"
          autoCapitalize="characters"
          maxLength={2}
          value={countryCode}
          onChangeText={(t) => {
            invalidateCapturedLocation();
            setCountryCode(t.toUpperCase());
          }}
        />

        <View style={{ gap: spacing.sm }}>
          <Button
            variant={coords ? "secondary" : "primary"}
            label={locationLabel}
            onPress={onUseLocation}
            loading={locating}
            leftIcon={
              coords ? (
                <Text variant="bodyStrong" color="success">
                  ✓
                </Text>
              ) : undefined
            }
          />
          <Pressable
            onPress={() => setCityPickerOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Pick a city instead"
          >
            <Text variant="captionStrong" color="textBrand" align="center">
              Or pick a city instead
            </Text>
          </Pressable>
          {locationError ? (
            <Text variant="caption" color="warning" align="center">
              {locationError}
            </Text>
          ) : null}
        </View>

        {error ? (
          <Text variant="caption" color="error">
            {error}
          </Text>
        ) : null}
      </View>

      <CenterDialog
        visible={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        accessibilityLabel="Pick a city"
      >
        <Text variant="subheading" style={{ marginBottom: spacing.xs }}>
          Pick a city
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {CITY_PRESETS.map((preset) => {
            const active = coords?.source === "preset" && coords.presetLabel === preset.label;
            return (
              <Chip
                key={preset.label}
                label={preset.label}
                selected={active}
                tone={active ? "brand" : "neutral"}
                onPress={() => onPickCity(preset)}
              />
            );
          })}
        </View>
        <View style={{ marginTop: spacing.xl, alignItems: "center" }}>
          <Text variant="caption" color="textSubdued">
            Don’t see your city? Type it into the City field above.
          </Text>
        </View>
      </CenterDialog>

      {/* Visual accent showing the selected location at-a-glance. */}
      {coords && !flow.editMode ? (
        <View
          style={{
            marginTop: spacing.lg,
            marginHorizontal: spacing.xl,
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: palette.brandSubdued,
          }}
        >
          <Text variant="caption" color="textBrand" align="center">
            ✓ Location set · we’ll show you people within your discovery radius.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
};
