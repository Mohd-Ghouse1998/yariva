import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import type { DiscoveryPreferenceDto } from "../../types/profile";
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

  useEffect(() => {
    if (!visible) return;
    setIntents(initialPreference.intentFilter ?? []);
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
    setSaving(true);
    try {
      await profilesApi.setDiscovery({
        ...initialPreference,
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
    setDistance(50);
  };

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
            <Header title="Discovery filters" bordered rightSlot={
              <IconButton
                tone="ghost"
                size={40}
                onPress={close}
                disabled={saving}
                accessibilityLabel="Close discovery filters"
              >
                <Icon name="x" size={19} color={palette.textSecondary} />
              </IconButton>
            } />

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
      </View>
    </Modal>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
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
