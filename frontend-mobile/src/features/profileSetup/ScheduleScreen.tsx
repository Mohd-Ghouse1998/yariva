import * as Localization from "expo-localization";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profilesApi } from "../../api/endpoints/profiles";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useToast } from "../../components/ui/Toast";
import { useTheme } from "../../theme/ThemeContext";
import { controlSize, radius, spacing } from "../../theme/spacing";
import type { SchedulePreferenceDto } from "../../types/profile";
import { ProfileSectionLoadState } from "./ProfileSectionLoadState";
import { useProfileHydration } from "./useProfileHydration";
import { useProfileSectionFlow } from "./useProfileSectionFlow";
import { scheduleDayLayout } from "./scheduleLayout";

const DAYS = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday" },
  { short: "Sun", full: "Sunday" },
] as const;
const TIME_BLOCKS = ["Mornings", "Lunchtime", "Afternoons", "Evenings", "Late nights"];

const empty: SchedulePreferenceDto = {
  weekdayMask: 0,
  timeBlockMask: 0,
  prefersWeekends: true,
  remoteFriendly: false,
  maxMeetupsPerWeek: 2,
  preferredLeadTimeDays: 3,
  timezone: null,
};

const setBit = (mask: number, bit: number, on: boolean) =>
  on ? mask | (1 << bit) : mask & ~(1 << bit);
const hasBit = (mask: number, bit: number) => (mask & (1 << bit)) !== 0;

export const ScheduleScreen: React.FC = () => {
  const { palette } = useTheme();
  const toast = useToast();
  const formLayout = useProfileFormLayout();
  const flow = useProfileSectionFlow("/(onboarding)/discovery-preferences");
  const hydration = useProfileHydration();
  const [value, setValue] = useState<SchedulePreferenceDto>(empty);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const meetupLimitFocused = useRef(false);
  const { fontScale } = useWindowDimensions();
  const [dayRowWidth, setDayRowWidth] = useState(0);
  const dayLayout = scheduleDayLayout(dayRowWidth || 320, fontScale);

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = Keyboard.addListener("keyboardDidShow", event => {
      if (!meetupLimitFocused.current) return;
      // Wait for KeyboardAvoidingView's resize animation before scrolling.
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (meetupLimitFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
      }, event.duration || 250);
    });
    return () => {
      subscription.remove();
      clearTimeout(scrollTimer);
    };
  }, []);

  useEffect(() => {
    if (!hydration.profile) return;
    setValue({
      ...hydration.profile.schedulePreference,
      timezone:
        hydration.profile.schedulePreference.timezone ??
        Localization.getCalendars()[0]?.timeZone ??
        null,
    });
  }, [hydration.profile]);

  const onContinue = async () => {
    setSubmitting(true);
    try {
      await profilesApi.setSchedule(value);
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
        title={flow.editMode ? "Usually free" : "When are you usually free?"}
        subtitle={
          flow.editMode
            ? "Usually free"
            : "So we don’t show you people whose week never lines up with yours."
        }
        step={flow.editMode ? undefined : 6}
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
          step={flow.editMode ? undefined : 6}
          total={flow.editMode ? undefined : 9}
          contextLabel={flow.stepLabel}
          title={flow.editMode ? "Usually free" : "When are you usually free?"}
          subtitle={
            flow.editMode
              ? "Usually free"
              : "So we don’t show you people whose week never lines up with yours."
          }
          onBack={flow.goBack}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={formLayout.content}
          >
            <View>
              <Text variant="bodyStrong" style={styles.sectionLabel}>
                Days
              </Text>
              <View style={styles.dayRow} onLayout={event => setDayRowWidth(event.nativeEvent.layout.width)}>
                {DAYS.map((day, i) => {
                  const active = hasBit(value.weekdayMask, i);
                  return (
                    <Pressable
                      key={i}
                      accessibilityRole="checkbox"
                      accessibilityLabel={day.full}
                      accessibilityState={{ checked: active }}
                      onPress={() =>
                        setValue((s) => ({
                          ...s,
                          weekdayMask: setBit(s.weekdayMask, i, !active),
                        }))
                      }
                      style={({ pressed }) => [
                        styles.dayTarget,
                        { width: dayLayout.itemWidth },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.dayVisual,
                          {
                            backgroundColor: active ? palette.brandSubdued : palette.surface,
                            borderColor: active ? palette.brandBorder : palette.border,
                          },
                        ]}
                      >
                        <Text
                          variant="captionStrong"
                          weight="500"
                          color={active ? "textBrand" : "textPrimary"}
                          style={styles.dayLabel}
                        >
                          {day.short}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text variant="bodyStrong" style={styles.sectionLabel}>
                Time of day
              </Text>
              <View style={styles.timeOptions}>
                {TIME_BLOCKS.map((b, i) => (
                  <Chip
                    key={b}
                    label={b}
                    size="sm"
                    selected={hasBit(value.timeBlockMask, i)}
                    onPress={() =>
                      setValue((s) => ({
                        ...s,
                        timeBlockMask: setBit(s.timeBlockMask, i, !hasBit(s.timeBlockMask, i)),
                      }))
                    }
                  />
                ))}
              </View>
            </View>

            <Card padded={false} style={styles.preferences}>
              <ToggleRow
                grouped
                first
                label="Prefer weekends"
                style={styles.preferenceRow}
                value={value.prefersWeekends}
                onValueChange={(v) => setValue((s) => ({ ...s, prefersWeekends: v }))}
              />
              <ToggleRow
                grouped
                label="Open to online meets"
                style={styles.preferenceRow}
                value={value.remoteFriendly}
                onValueChange={(v) => setValue((s) => ({ ...s, remoteFriendly: v }))}
              />
              <View style={[styles.meetupLimitRow, { borderTopColor: palette.divider }]}>
                <Text variant="bodyStrong" style={styles.meetupLimitLabel}>
                  Max meetups per week
                </Text>
                <Input
                  accessibilityLabel="Max meetups per week"
                  keyboardType="number-pad"
                  onFocus={() => {
                    meetupLimitFocused.current = true;
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }}
                  onBlur={() => { meetupLimitFocused.current = false; }}
                  containerStyle={styles.meetupLimitInput}
                  controlStyle={styles.meetupLimitControl}
                  style={styles.meetupLimitValue}
                  value={value.maxMeetupsPerWeek != null ? String(value.maxMeetupsPerWeek) : ""}
                  onChangeText={(t) => {
                    const n = /^\d+$/.test(t) ? Number(t) : null;
                    setValue((s) => ({
                      ...s,
                      maxMeetupsPerWeek: n !== null && Number.isSafeInteger(n) ? n : null,
                    }));
                  }}
                />
              </View>
            </Card>
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.sm,
    rowGap: 0,
  },
  dayTarget: {
    minWidth: controlSize.minimumTouchTarget,
    minHeight: controlSize.minimumTouchTarget,
    justifyContent: "center",
  },
  dayVisual: {
    minHeight: controlSize.buttonSmall,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.76,
  },
  timeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.sm,
    rowGap: 0,
  },
  preferenceRow: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  preferences: {
    overflow: "hidden",
  },
  meetupLimitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  meetupLimitLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  meetupLimitInput: {
    width: 72,
  },
  meetupLimitControl: {
    minHeight: controlSize.minimumTouchTarget,
  },
  meetupLimitValue: {
    textAlign: "center",
    fontSize: 14,
  },
});
