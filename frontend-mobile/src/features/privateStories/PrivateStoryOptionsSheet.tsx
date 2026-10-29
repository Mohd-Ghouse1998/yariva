import React, { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { privateStoriesApi, type Story } from "../../api/endpoints/privateStories";
import { Button } from "../../components/ui/Button";
import { NavigationListRow } from "../../components/ui/NavigationList";
import { Text } from "../../components/ui/Text";
import { useLocalization } from "../../localization/LocalizationContext";
import { useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";

interface Props {
  story: Story;
  onClose: () => void;
  onChange: (story: Story | null) => void;
  onEdit?: (story: Story) => void;
}

// Both the collection and viewer use this owner menu. All mutations are authorized
// again by the server; a gallery row or an old signed URL is never permission.
export function PrivateStoryOptionsSheet({ story, onClose, onChange, onEdit }: Props) {
  const { palette } = useTheme();
  const { t } = useLocalization();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const remaining = Date.parse(story.expiresAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [story.expiresAt]);
  const active = Date.parse(story.expiresAt) > now;
  const mutate = async (remove = false) => {
    if (inFlight.current || !mounted.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      if (remove) {
        await privateStoriesApi.remove(story.id);
        if (mounted.current) {
          onChange(null);
          onClose();
        }
      } else {
        const result = await privateStoriesApi.setSaved(story.id, !story.savedAt);
        if (mounted.current) onChange({ ...story, ...result.story });
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("story.archive.closeOptions")}
          disabled={busy}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlayDark }]}
        />
        <SafeAreaView
          edges={["bottom"]}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: palette.surface }]}
        >
          <View
            accessible={false}
            style={[styles.handle, { backgroundColor: palette.textSubdued }]}
          />
          <ScrollView contentContainerStyle={styles.content}>
            {active || story.savedAt ? (
              <NavigationListRow
                first
                icon="bookmark"
                chevron={false}
                label={t(story.savedAt ? "story.archive.unsave" : "story.archive.save")}
                meta={t(story.savedAt ? "story.archive.savedHint" : "story.archive.saveHint")}
                metaLines={3}
                disabled={busy}
                onPress={() => void mutate()}
              />
            ) : null}
            {active && story.moderationStatus !== "REJECTED" && onEdit ? (
              <NavigationListRow
                icon="people"
                chevron={false}
                label={t("story.archive.edit")}
                meta={t("story.archive.editHint")}
                metaLines={3}
                disabled={busy}
                onPress={() => {
                  onClose();
                  onEdit(story);
                }}
              />
            ) : null}
            <NavigationListRow
              icon="trash"
              chevron={false}
              danger
              label={t("story.archive.delete")}
              meta={t("story.archive.deleteHint")}
              metaLines={3}
              disabled={busy}
              onPress={() =>
                Alert.alert(t("story.archive.deleteTitle"), t("story.archive.deleteBody"), [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("story.archive.delete"),
                    style: "destructive",
                    onPress: () => void mutate(true),
                  },
                ])
              }
            />
            {error ? (
              <Text color="error" accessibilityRole="alert">
                {t("story.archive.actionError")}
              </Text>
            ) : null}
            {busy ? (
              <Text variant="caption" color="textSubdued" accessibilityLiveRegion="polite">
                {t("story.archive.updating")}
              </Text>
            ) : null}
            <Button
              label={t("common.cancel")}
              variant="secondary"
              disabled={busy}
              onPress={onClose}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "80%", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: {
    width: spacing.xxl,
    height: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
});
