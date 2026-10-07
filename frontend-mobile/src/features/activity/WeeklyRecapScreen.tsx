import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type Svg from "react-native-svg";
import { activityApi } from "../../api/endpoints/activity";
import { Header } from "../../components/layout/Header";
import { useProfileFormLayout } from "../../components/profile/useProfileFormLayout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { NavigationListSection } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { useToast } from "../../components/ui/Toast";
import { syncPushRegistration } from "../../notifications/pushRegistration";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useTheme } from "../../theme/ThemeContext";
import { useLocalization } from "../../localization/LocalizationContext";
import { spacing } from "../../theme/spacing";
import type { ActivitySummary, WeeklyRecap } from "../../types/activity";
import { useSerializedSettings } from "../settings/useSerializedSettings";
import { clearExpiredRecapExports, shareRecapCard } from "./exportRecap";
import {
  recapHasActivity,
  recapMetrics,
  recapPeriod,
  recapPeriodLabel,
  recapPreviewSize,
} from "./recapLogic";
import { RecapShareCard } from "./RecapShareCard";
import { changeRecapNotifications } from "./recapNotifications";

const loadPreferences = () => activityApi.summary();
const savePreferences = (value: ActivitySummary) =>
  activityApi.preferences({
    displayEnabled: value.displayEnabled,
    recapNotificationsEnabled: value.recapNotificationsEnabled,
  });

export const WeeklyRecapScreen = () => {
  const { palette } = useTheme();
  const { t } = useLocalization();
  const toast = useToast();
  const back = useSafeBack("/(app)/(tabs)/profile");
  const form = useProfileFormLayout();
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const previewHeight = Math.max(
    0,
    height -
      Math.max(insets.top, spacing.xl) -
      Math.max(insets.bottom, spacing.xl) -
      spacing.lg * 2,
  );
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [permissionPending, setPermissionPending] = useState(false);
  const permissionPendingRef = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [includeMetrics, setIncludeMetrics] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0);
  const previewSize = recapPreviewSize(
    previewWidth,
    Math.max(0, previewHeight - (fontScale > 1.2 ? 320 : 260)),
  );
  const [shareError, setShareError] = useState(false);
  const shareCard = useRef<Svg | null>(null);
  const requestSequence = useRef(0);
  const preferences = useSerializedSettings({
    load: loadPreferences,
    save: savePreferences,
    saveErrorMessage: "Couldn’t save recap preferences.",
  });
  const preferencesBusy = preferences.saving || permissionPending;
  const updateNotifications = async (enabled: boolean) => {
    if (permissionPendingRef.current || preferences.saving || !preferences.value) return;
    permissionPendingRef.current = true;
    setPermissionPending(true);
    try {
      const result = await changeRecapNotifications(
        enabled,
        syncPushRegistration,
        (recapNotificationsEnabled) =>
          preferences.update({ ...preferences.value!, recapNotificationsEnabled }),
      );
      if (result === "UNAVAILABLE")
        toast.show("Enable notifications in phone settings for recaps.", "info");
    } catch {
      toast.show("Push registration did not finish. Try again when you’re online.", "error");
    } finally {
      permissionPendingRef.current = false;
      setPermissionPending(false);
    }
  };
  useEffect(() => {
    try {
      clearExpiredRecapExports();
    } catch {
      /* Cache cleanup never blocks a private recap. */
    }
  }, []);
  const load = useCallback(async () => {
    const request = ++requestSequence.current;
    setLoading(true);
    setError(false);
    try {
      const next = (await activityApi.recap()).recap;
      if (request === requestSequence.current) setRecap(next);
    } catch {
      if (request === requestSequence.current) {
        setRecap(null);
        setError(true);
      }
    } finally {
      if (request === requestSequence.current) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      return () => {
        requestSequence.current += 1;
        listener.remove();
      };
    }, [load]),
  );

  const share = async () => {
    if (sharing || !shareCard.current) return;
    setSharing(true);
    setShareError(false);
    try {
      // Let the selected privacy model commit to the native SVG before rendering.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!shareCard.current) throw new Error("Preview closed");
      await shareRecapCard(shareCard.current);
    } catch {
      setShareError(true);
    } finally {
      setSharing(false);
    }
  };
  const period = recap ? recapPeriod(recap) : null;
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <Header
        title={t("activity.title")}
        showBack
        onLeftPress={back}
        rightSlot={
          <IconButton
            accessibilityLabel={t("activity.preferences")}
            tone="ghost"
            onPress={() => setPreferencesOpen(true)}
          >
            <Icon name="settings" size={20} />
          </IconButton>
        }
      />
      {loading ? (
        <Text style={form.content}>{t("activity.loading")}</Text>
      ) : error || !recap ? (
        <EmptyState
          title={t("activity.unavailable")}
          body={t("activity.retryHint")}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : (
        <ScrollView contentContainerStyle={form.content}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <Icon name="lock" size={14} color={palette.textSubdued} />
                <Text variant="captionStrong" color="textSubdued">
                  {t("activity.private")}
                </Text>
              </View>
              <Text variant="caption" color="textSecondary">
                {recapPeriodLabel(recap)}
              </Text>
            </View>
            <IconButton
              accessibilityLabel={t("activity.period")}
              tone="ghost"
              onPress={() => setAboutOpen(true)}
            >
              <Icon name="clock" size={20} />
            </IconButton>
          </View>
          <Card elevated={false} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon name="sparkle" size={20} color={palette.textBrand} />
              <Text variant="titleSm" style={{ flex: 1 }}>
                {!recap.historyAvailable
                  ? t("activity.noHistory")
                  : !recapHasActivity(recap)
                    ? t("activity.quiet")
                    : t("activity.atYourPace")}
              </Text>
            </View>
            {recap.historyAvailable ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
                {recapMetrics(recap, t).map((metric) => (
                  <View
                    key={metric.label}
                    style={{ flexBasis: "44%", flexGrow: 1, gap: spacing.xs }}
                  >
                    <Text variant="title">{metric.value}</Text>
                    <Text variant="caption" color="textSecondary">
                      {metric.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="caption" color="textSubdued">
                {t("activity.noHistoryHint")}
              </Text>
            )}
            {recap.partialHistory && recap.historyAvailable ? (
              <Text variant="caption" color="textSubdued">
                {t("activity.partial")}
              </Text>
            ) : null}
          </Card>
          {preferences.value?.enabled && preferences.value.displayEnabled ? (
            <NavigationListSection label={t("activity.current")}>
              <View
                style={{
                  padding: spacing.md,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.md,
                }}
              >
                <View style={{ flexBasis: "44%", flexGrow: 1, gap: spacing.xs }}>
                  <Text variant="caption" color="textSecondary">
                    {t("activity.streak")}
                  </Text>
                  <Text variant="titleSm">
                    {t("activity.days", { days: preferences.value.currentStreak })}
                  </Text>
                  {preferences.value.longestStreak > 0 ? (
                    <Text variant="caption" color="textSubdued">
                      {t("activity.longest", { days: preferences.value.longestStreak })}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexBasis: "44%", flexGrow: 1, gap: spacing.xs }}>
                  <Text variant="caption" color="textSecondary">
                    {t("activity.points")}
                  </Text>
                  <Text variant="titleSm">{preferences.value.balance}</Text>
                </View>
              </View>
            </NavigationListSection>
          ) : null}
          {recap.historyAvailable ? (
            <Button
              label={t("activity.preview")}
              variant="secondary"
              onPress={() => {
                setIncludeMetrics(false);
                setShareError(false);
                setPreviewOpen(true);
              }}
            />
          ) : null}
        </ScrollView>
      )}

      <CenterDialog
        visible={aboutOpen}
        onClose={() => setAboutOpen(false)}
        accessibilityLabel={t("activity.period")}
        style={{ maxHeight: previewHeight, gap: spacing.md }}
      >
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }}>
          <Text variant="titleSm">{t("activity.period")}</Text>
          <Text variant="body">
            {period?.start} – {period?.end} IST
          </Text>
          <Text variant="caption" color="textSecondary">
            {t("activity.periodHint")}
          </Text>
          {recap?.partialHistory ? (
            <Text variant="caption" color="textSecondary">
              {t("activity.partial")} ·{" "}
              {recap.historyStartedAt
                ? new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(recap.historyStartedAt))
                : ""}
            </Text>
          ) : null}
          <Text variant="caption" color="textSecondary">
            {t("activity.nonCash")}
          </Text>
        </ScrollView>
        <Button label={t("activity.done")} variant="ghost" onPress={() => setAboutOpen(false)} />
      </CenterDialog>

      <CenterDialog
        visible={preferencesOpen}
        onClose={() => {
          if (!preferencesBusy) setPreferencesOpen(false);
        }}
        accessibilityLabel={t("activity.preferences")}
      >
        <View style={{ gap: spacing.md }}>
          <Text variant="titleSm">{t("activity.preferences")}</Text>
          {preferences.loading ? (
            <Text variant="caption" color="textSubdued">
              Loading preferences…
            </Text>
          ) : preferences.value && !preferences.loadError ? (
            <NavigationListSection>
              <ToggleRow
                grouped
                first
                label={t("activity.display")}
                value={preferences.value.displayEnabled}
                disabled={preferencesBusy}
                onValueChange={(displayEnabled) =>
                  void preferences.update({ ...preferences.value!, displayEnabled })
                }
              />
              <ToggleRow
                grouped
                label={t("activity.notifications")}
                sub={t("activity.notificationsHint")}
                value={preferences.value.recapNotificationsEnabled}
                disabled={preferencesBusy}
                onValueChange={(enabled) => void updateNotifications(enabled)}
              />
            </NavigationListSection>
          ) : (
            <Button
              label="Retry preferences"
              variant="secondary"
              onPress={() => void preferences.reload()}
            />
          )}
          <Button
            label="Done"
            variant="ghost"
            disabled={preferencesBusy}
            onPress={() => setPreferencesOpen(false)}
          />
        </View>
      </CenterDialog>

      <CenterDialog
        visible={previewOpen && Boolean(recap)}
        onClose={() => {
          if (!sharing) setPreviewOpen(false);
        }}
        accessibilityLabel="Share card preview"
        style={{ maxHeight: previewHeight }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <Text variant="titleSm" style={{ flex: 1 }}>
            {t("activity.shareCard")}
          </Text>
          <IconButton
            accessibilityLabel={t("activity.closePreview")}
            disabled={sharing}
            onPress={() => setPreviewOpen(false)}
          >
            <Icon name="close" size={20} />
          </IconButton>
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }}>
          <View
            onLayout={(event) => setPreviewWidth(event.nativeEvent.layout.width)}
            style={{ width: "100%", alignItems: "center" }}
          >
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={
                includeMetrics && recap?.historyAvailable
                  ? "Yariva week card with your selected weekly activity"
                  : "Yariva week card. No private activity included."
              }
              style={{ width: previewSize.width, height: previewSize.height, alignSelf: "center" }}
            >
              {recap ? (
                <RecapShareCard ref={shareCard} recap={recap} includeMetrics={includeMetrics} />
              ) : null}
            </View>
          </View>
          {recap?.historyAvailable ? (
            <ToggleRow
              label={t("activity.include")}
              sub={t("activity.offByDefault")}
              value={includeMetrics}
              disabled={sharing || !recap?.historyAvailable}
              onValueChange={setIncludeMetrics}
            />
          ) : null}
          {shareError ? (
            <Text variant="caption" color="error" accessibilityRole="alert">
              {t("activity.shareError")}
            </Text>
          ) : null}
        </ScrollView>
        <Button
          label={t("activity.share")}
          loading={sharing}
          onPress={() => void share()}
          style={{ marginTop: spacing.md }}
        />
      </CenterDialog>
    </SafeAreaView>
  );
};
