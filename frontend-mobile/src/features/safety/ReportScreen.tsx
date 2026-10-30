import { useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { safetyApi } from "../../api/endpoints/safety";
import { analyticsApi } from "../../api/endpoints/analytics";
import { ApiError } from "../../api/errors";
import { Header } from "../../components/layout/Header";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useToast } from "../../components/ui/Toast";
import { useLocalization } from "../../localization/LocalizationContext";
import { useSafeBack } from "../../navigation/useSafeBack";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { typography } from "../../theme/typography";
import type { ReportReasonCode, ReportTargetType } from "../../types/enums";

// Mirrors aroha_ui_deisgn_files/profile-settings.jsx > ScreenReport. Top bar
// has a CLOSE icon (×) instead of a back arrow because it's a modal.
const REASONS: Array<{ code: ReportReasonCode; label: string }> = [
  { code: "INAPPROPRIATE_CONTENT", label: "Inappropriate photos" },
  { code: "HARASSMENT", label: "Harassment or hate" },
  { code: "SPAM", label: "Spam or scam" },
  { code: "UNDERAGE", label: "Underage" },
  { code: "FAKE_PROFILE", label: "Impersonation" },
  { code: "OTHER", label: "Other" },
];

export const ReportScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  const goBack = useSafeBack("/(app)/(tabs)/chats");
  const toast = useToast();
  const { t } = useLocalization();
  const params = useLocalSearchParams<{
    targetType: string;
    targetId: string;
    reportedUserId?: string;
  }>();
  const isEvent = params.targetType === "EVENT_LISTING";
  const copy = (key: string, fallback: string) => isEvent ? t(`events.report.${key}`) : fallback;
  const reasons = isEvent ? (["SAFETY_RISK", "SPAM", "INAPPROPRIATE_CONTENT", "OTHER"] as const)
    .map(code => ({ code, label: t(`events.report.reason.${code}`) })) : REASONS;

  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const onSubmit = async () => {
    const targetType = params.targetType as ReportTargetType | undefined;
    const reportedUserId =
      params.reportedUserId ?? (targetType === "USER" ? params.targetId : undefined);

    if (!reason || !targetType || !params.targetId || (targetType !== "EVENT_LISTING" && !reportedUserId)) {
      toast.show(copy("choose", "Pick a reason first."), "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await safetyApi.report({
        targetType,
        reportedUserId: targetType === "EVENT_LISTING" ? null : reportedUserId,
        reasonCode: reason,
        description: description.trim() || null,
        ...(targetType === "EVENT_LISTING" ? { targetEventId: params.targetId } : targetType === "MATCH"
          ? { targetMatchId: params.targetId }
          : targetType === "CONVERSATION"
            ? { targetConversationId: params.targetId }
            : targetType === "MESSAGE"
              ? { targetMessageId: params.targetId }
              : targetType === "PROFILE_PHOTO"
                ? { targetPhotoId: params.targetId }
                : targetType === "CALL_SESSION"
                  ? { targetCallSessionId: params.targetId }
                  : targetType === "PRIVATE_STORY"
                    ? { targetPrivateStoryId: params.targetId }
                  : {}),
      });
      if (res.isDuplicate) {
        toast.show(copy("duplicate", "You’ve already reported this. Our team will follow up."), "info");
      } else {
        toast.show(copy("success", "Report submitted. Thank you."), "success");
        void analyticsApi
          .ingest([
            {
              name: "safety_report_created",
              contextId: params.targetId,
              properties: { targetType, reasonCode: reason },
            },
          ])
          .catch(() => undefined);
      }
      goBack();
    } catch (err) {
      if (err instanceof ApiError && err.isDuplicate()) {
        toast.show(copy("duplicate", "You’ve already reported this."), "info");
        goBack();
      } else {
        toast.show(copy("error", "Couldn’t submit report."), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <Header
          title={copy("title", "Report")}
          leftIcon={<Icon name="x" size={22} />}
          onLeftPress={goBack}
          leftAccessibilityLabel={copy("close", "Close")}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 20,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.banner}>
              <Text variant="caption" style={{ color: palette.textBrand, lineHeight: 18 }}>
                {copy("privacy", "Reports are reviewed by our safety team. You’re never told whose report it was, and the person isn’t told either.")}
              </Text>
            </View>

            <Text variant="bodyStrong" style={{ marginTop: 16, marginBottom: 10 }}>
              {copy("question", "What’s happening?")}
            </Text>
            <View style={{ gap: 6 }}>
              {reasons.map((r) => {
                const active = reason === r.code;
                return (
                  <Pressable
                    key={r.code}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={r.label}
                    onPress={() => setReason(r.code)}
                    style={[
                      styles.reasonRow,
                      {
                        borderColor: active ? palette.brandBorder : palette.border,
                      },
                    ]}
                  >
                    <Text variant="bodyStrong" style={{ flex: 1, fontWeight: "500" }}>
                      {r.label}
                    </Text>
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: active ? palette.brand : palette.borderStrong,
                        },
                      ]}
                    >
                      {active ? <View style={styles.radioInner} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text
              variant="captionStrong"
              color="textSubdued"
              style={{ marginTop: 18, marginBottom: 6 }}
            >
              {copy("details", "Anything else? (optional)")}
            </Text>
            <TextInput
              accessibilityLabel={copy("details.label", "Additional report details")}
              multiline
              placeholder={copy("placeholder", "Add details to help us…")}
              placeholderTextColor={palette.textMuted}
              value={description}
              onChangeText={setDescription}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
              }}
              style={styles.textarea}
              maxLength={2000}
            />
          </ScrollView>
          <View style={styles.footer}>
            <Button
              label={copy("submit", "Submit report")}
              onPress={onSubmit}
              loading={submitting}
              disabled={!reason}
              fullWidth
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  banner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: palette.brandSubdued,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.brand,
  },
  textarea: {
    ...typography.body,
    minHeight: 90,
    padding: 14,
    borderRadius: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.textPrimary,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.divider,
    backgroundColor: palette.background,
  },
}));
