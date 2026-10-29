import { WorkCategoryPicker } from "../profile/WorkCategoryPicker";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { interestsApi } from "../../api/endpoints/interests";
import { Chip } from "../../components/ui/Chip";
import { Input } from "../../components/ui/Input";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { splitUniqueList } from "../profile/profileEditForm";
import { humanizeProfileValue } from "../../utils/format";
import { SMOKING_HABIT, DRINKING_HABIT, EXERCISE_HABIT } from "../../types/enums";
import { profilesApi } from "../../api/endpoints/profiles";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { RangeSlider, SingleSlider } from "../../components/ui/RangeSlider";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { shadows } from "../../theme/shadows";
import type { ConnectionIntent } from "../../types/enums";
import type {
  DiscoveryPeopleFilters,
  DiscoveryPreferenceDto,
  InterestTagDto,
} from "../../types/profile";
import { DISCOVERY_DEFAULTS, DISCOVERY_LIMITS } from "../../config/discoveryPreferences";
import { CONNECTION_INTENT_OPTIONS } from "../../config/connectionIntents";

export interface DiscoveryFilterSheetProps {
  visible: boolean;
  initialPreference: DiscoveryPreferenceDto;
  onClose: () => void;
  onSaved: () => void;
}

export const DiscoveryFilterSheet: React.FC<DiscoveryFilterSheetProps> = ({
  visible,
  initialPreference,
  onClose,
  onSaved,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [intents, setIntents] = useState<ConnectionIntent[]>([]);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 99]);
  const [distance, setDistance] = useState(50);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<DiscoveryPeopleFilters>({});
  const [languages, setLanguages] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [sameCity, setSameCity] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [catalog, setCatalog] = useState<InterestTagDto[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [visibleInterests, setVisibleInterests] = useState(12);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCatalogStatus("loading");
    // The interest catalog is curated, paginated reference data, not user profiles.
    // Load every page so selected tags retain their labels when the sheet reopens.
    void (async () => {
      try {
        const tags: InterestTagDto[] = [];
        let cursor: string | undefined;
        do {
          const page = await interestsApi.catalog({ limit: 100, cursor });
          if (cancelled) return;
          tags.push(...page.items);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        setCatalog(tags);
        setCatalogStatus("ready");
      } catch {
        if (!cancelled) setCatalogStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, catalogRetry]);

  useEffect(() => {
    if (!visible) return;
    setIntents(initialPreference.intentFilter ?? []);
    setFilters({
      interestTagIds: initialPreference.interestTagIds ?? [],
      occupationFilter: initialPreference.occupationFilter ?? null,
      occupationCategoryFilter: initialPreference.occupationCategoryFilter ?? [],
      smokingFilter: initialPreference.smokingFilter ?? [],
      drinkingFilter: initialPreference.drinkingFilter ?? [],
      exerciseFilter: initialPreference.exerciseFilter ?? [],
    });
    setLanguages((initialPreference.languageFilter ?? []).join(", "));
    setRecentOnly(initialPreference.includeRecentlyActiveOnly);
    setSameCity(initialPreference.preferSameCity);
    setSearch("");
    setAdvanced(false);
    setVisibleInterests(12);
    setAgeRange([
      initialPreference.minAge ?? DISCOVERY_LIMITS.minimumAge,
      initialPreference.maxAge ?? DISCOVERY_LIMITS.maximumAge,
    ]);
    setDistance(initialPreference.maxDistanceKm ?? DISCOVERY_DEFAULTS.distanceKm);
  }, [visible, initialPreference]);

  const toggleIntent = (intent: ConnectionIntent) => {
    setIntents((current) =>
      current.includes(intent) ? current.filter((item) => item !== intent) : [...current, intent],
    );
  };

  const apply = async () => {
    if (saving) return;
    const languageFilter = splitUniqueList(languages);
    if (languageFilter.length > 10 || languageFilter.some((value) => value.length > 80)) {
      toast.show("Choose up to 10 languages, each within 80 characters.", "error");
      return;
    }
    setSaving(true);
    try {
      await profilesApi.setDiscovery({
        ...initialPreference,
        ...filters,
        languageFilter,
        occupationFilter: filters.occupationFilter?.trim() || null,
        includeRecentlyActiveOnly: recentOnly,
        preferSameCity: sameCity,
        minAge: ageRange[0],
        maxAge: ageRange[1],
        maxDistanceKm: distance,
        intentFilter: intents,
      });
      toast.show("Discovery preferences updated.", "success");
      onSaved();
      onClose();
    } catch {
      toast.show("Couldn’t save these preferences.", "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setIntents([]);
    setAgeRange([18, 99]);
    setDistance(DISCOVERY_DEFAULTS.distanceKm);
    setFilters({
      interestTagIds: [],
      occupationFilter: null,
      occupationCategoryFilter: [],
      smokingFilter: [],
      drinkingFilter: [],
      exerciseFilter: [],
    });
    setLanguages("");
    setRecentOnly(false);
    setSameCity(false);
  };

  const toggleFilter = <
    K extends "interestTagIds" | "smokingFilter" | "drinkingFilter" | "exerciseFilter",
  >(
    key: K,
    value: NonNullable<DiscoveryPeopleFilters[K]>[number],
  ) => {
    setFilters((current) => {
      const values = (current[key] ?? []) as string[];
      if (key === "interestTagIds" && values.length >= 20 && !values.includes(value)) {
        return current;
      }
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  };
  const selectedTags = filters.interestTagIds ?? [];
  const matchingTags = catalog.filter(
    (tag) =>
      !selectedTags.includes(tag.id) &&
      tag.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={close} accessible={false} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <SafeAreaView
            edges={["top", "bottom", "left", "right"]}
            pointerEvents="box-none"
            style={styles.modalFrame}
          >
            <View
              accessibilityViewIsModal
              accessibilityLabel="Discovery filters"
              style={[
                styles.dialog,
                shadows.lg,
                width <= 340 ? styles.dialogCompact : null,
                { maxHeight: Math.max(0, height - insets.top - insets.bottom - spacing.lg * 2) },
              ]}
            >
              <Header
                title="Discovery filters"
                bordered
                rightSlot={
                  <IconButton
                    tone="ghost"
                    size={40}
                    onPress={close}
                    disabled={saving}
                    accessibilityLabel="Close discovery filters"
                  >
                    <Icon name="x" size={19} color={palette.textSecondary} />
                  </IconButton>
                }
              />

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.section}>
                  <View style={styles.sectionHeading}>
                    <View style={styles.sectionTitleRow}>
                      <Icon name="heart" size={17} color={palette.brandStrong} />
                      <Text variant="captionStrong" color="textSecondary">
                        People looking for
                      </Text>
                    </View>
                    <Text variant="caption" color="textSubdued">
                      Match their intentions to yours.
                    </Text>
                  </View>
                  <View style={styles.intentGrid}>
                    {CONNECTION_INTENT_OPTIONS.map((option) => {
                      const active = intents.includes(option.value);
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => toggleIntent(option.value)}
                          disabled={saving}
                          accessibilityRole="checkbox"
                          accessibilityLabel={option.label}
                          accessibilityState={{ checked: active }}
                          style={({ pressed }) => [
                            styles.intentChoice,
                            active ? styles.intentChoiceActive : null,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <Text
                            variant="captionStrong"
                            color={active ? "textBrand" : "textSecondary"}
                            numberOfLines={2}
                            style={styles.intentLabel}
                          >
                            {option.label}
                          </Text>
                          <View style={[styles.check, active ? styles.checkActive : null]}>
                            {active ? (
                              <Icon
                                name="check"
                                size={12}
                                color={palette.textOnBrand}
                                strokeWidth={3}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {intents.length === 0 ? (
                    <Text variant="caption" color="textSubdued">
                      Any intent
                    </Text>
                  ) : null}
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <View style={styles.metricLabel}>
                      <Icon name="profile" size={17} color={palette.brandStrong} />
                      <Text variant="captionStrong" color="textSecondary">
                        Age range
                      </Text>
                    </View>
                    <View style={styles.valuePill}>
                      <Text variant="captionStrong" color="textBrand">
                        {ageRange[0]}–{ageRange[1] === 99 ? "99+" : ageRange[1]} years
                      </Text>
                    </View>
                  </View>
                  <RangeSlider
                    min={DISCOVERY_LIMITS.minimumAge}
                    max={DISCOVERY_LIMITS.maximumAge}
                    value={ageRange}
                    onChange={setAgeRange}
                    accessibilityLabel="Age range"
                  />
                  <View style={styles.endpoints}>
                    <Text variant="caption" color="textMuted">
                      18
                    </Text>
                    <Text variant="caption" color="textMuted">
                      99+
                    </Text>
                  </View>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <View style={styles.metricLabel}>
                      <Icon name="location" size={17} color={palette.brandStrong} />
                      <Text variant="captionStrong" color="textSecondary">
                        Distance
                      </Text>
                    </View>
                    <View style={styles.valuePill}>
                      <Text variant="captionStrong" color="textBrand">
                        {distance} km
                      </Text>
                    </View>
                  </View>
                  <SingleSlider
                    min={DISCOVERY_LIMITS.minimumDistanceKm}
                    max={DISCOVERY_LIMITS.maximumDistanceKm}
                    value={distance}
                    onChange={setDistance}
                    accessibilityLabel="Maximum distance"
                  />
                  <View style={styles.endpoints}>
                    <Text variant="caption" color="textMuted">
                      1 km
                    </Text>
                    <Text variant="caption" color="textMuted">
                      250 km
                    </Text>
                  </View>
                </View>
                <View style={styles.section}>
                  <Text variant="captionStrong">Hobbies & interests</Text>
                  <Text variant="caption" color="textSubdued">
                    Match any selected interest. Leave empty for everyone.
                  </Text>
                  {selectedTags.length > 0 ? (
                    <View style={styles.filterChips}>
                      {selectedTags.map((id) => (
                        <Chip
                          key={id}
                          selected
                          disabled={saving}
                          label={`${catalog.find((tag) => tag.id === id)?.displayName ?? "Selected interest"} ×`}
                          onPress={() => toggleFilter("interestTagIds", id)}
                        />
                      ))}
                    </View>
                  ) : null}
                  <Input
                    label="Find an interest"
                    value={search}
                    editable={!saving}
                    maxLength={80}
                    placeholder="Coffee, music, hiking…"
                    onChangeText={(value) => {
                      setSearch(value);
                      setVisibleInterests(12);
                    }}
                  />
                  {catalogStatus === "loading" ? (
                    <Text variant="caption" color="textSubdued">
                      Loading interests…
                    </Text>
                  ) : null}
                  {catalogStatus === "error" ? (
                    <Button
                      variant="ghost"
                      label="Retry loading interests"
                      disabled={saving}
                      onPress={() => setCatalogRetry((value) => value + 1)}
                    />
                  ) : null}
                  {catalogStatus === "ready" ? (
                    <>
                      <View style={styles.filterChips}>
                        {matchingTags.slice(0, visibleInterests).map((tag) => (
                          <Chip
                            key={tag.id}
                            label={tag.displayName}
                            disabled={saving || selectedTags.length >= 20}
                            onPress={() => toggleFilter("interestTagIds", tag.id)}
                          />
                        ))}
                      </View>
                      {matchingTags.length === 0 ? (
                        <Text variant="caption" color="textSubdued">
                          No interests found. Try another word.
                        </Text>
                      ) : null}
                      {matchingTags.length > visibleInterests ? (
                        <Button
                          variant="ghost"
                          label="More interests"
                          disabled={saving}
                          onPress={() => setVisibleInterests((value) => value + 12)}
                        />
                      ) : null}
                    </>
                  ) : null}
                </View>
                <Input
                  label="Languages"
                  placeholder="English, Hindi, Telugu"
                  value={languages}
                  editable={!saving}
                  onChangeText={setLanguages}
                  helper="Separate languages with commas. Matches any selected language."
                />
                <Button
                  variant="ghost"
                  label={advanced ? "Hide advanced filters" : "Advanced filters"}
                  disabled={saving}
                  onPress={() => setAdvanced((value) => !value)}
                />
                {advanced ? (
                  <View style={styles.section}>
                    <WorkCategoryPicker
                      multiple
                      selected={filters.occupationCategoryFilter ?? []}
                      disabled={saving}
                      onChange={(values) => setFilters((current) => ({ ...current, occupationCategoryFilter: values }))}
                    />
                    <Input
                      label="Work or study"
                      placeholder="Designer, engineer, student…"
                      maxLength={80}
                      editable={!saving}
                      value={filters.occupationFilter ?? ""}
                      onChangeText={(value) =>
                        setFilters((current) => ({ ...current, occupationFilter: value }))
                      }
                      helper="Optional title keyword. Only shared work details are searchable."
                    />
                    {(
                      [
                        ["smokingFilter", "Smoking", SMOKING_HABIT],
                        ["drinkingFilter", "Drinking", DRINKING_HABIT],
                        ["exerciseFilter", "Exercise", EXERCISE_HABIT],
                      ] as const
                    ).map(([key, label, options]) => (
                      <View key={key} style={styles.section}>
                        <Text variant="captionStrong">{label}</Text>
                        <View style={styles.filterChips}>
                          {options.map((value) => (
                            <Chip
                              key={value}
                              label={humanizeProfileValue(value) ?? value}
                              disabled={saving}
                              selected={
                                (filters[key] as readonly string[] | undefined)?.includes(value) ??
                                false
                              }
                              onPress={() => toggleFilter(key, value)}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                    <ToggleRow
                      label="Recently active only"
                      sub="Active in the past 7 days."
                      value={recentOnly}
                      disabled={saving}
                      onValueChange={setRecentOnly}
                    />
                    <ToggleRow
                      label="Prefer same city"
                      sub="Prioritize people in your city."
                      value={sameCity}
                      disabled={saving}
                      onValueChange={setSameCity}
                    />
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.footer}>
                <Button
                  label="Reset"
                  variant="ghost"
                  onPress={reset}
                  disabled={saving}
                  style={styles.resetButton}
                />
                <Button
                  label="Apply filters"
                  onPress={() => void apply()}
                  loading={saving}
                  style={styles.applyButton}
                />
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: palette.overlayDark,
  },
  modalFrame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialog: {
    width: "100%",
    maxWidth: 520,
    flexShrink: 1,
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  dialogCompact: {
    borderRadius: radius.xl,
  },
  scroll: {
    flexShrink: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    gap: spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  intentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  intentChoice: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 128,
    minHeight: 48,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  intentChoiceActive: {
    backgroundColor: palette.brandSubdued,
    borderColor: palette.brandBorder,
  },
  intentLabel: {
    flex: 1,
    minWidth: 0,
  },
  check: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  checkActive: {
    backgroundColor: palette.brandStrong,
    borderColor: palette.brandStrong,
  },
  metricCard: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.divider,
  },
  metricHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  metricLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  valuePill: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceTint,
  },
  endpoints: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -spacing.sm,
  },
  footer: {
    minHeight: 64,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  resetButton: {
    minWidth: 88,
  },
  applyButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
}));
