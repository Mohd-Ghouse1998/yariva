import { Image } from "expo-image";
import React from "react";
import { View } from "react-native";
import type { PublicProfileDto } from "../../types/profile";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { Button } from "../ui/Button";
import { CenterDialog } from "../ui/CenterDialog";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Input } from "../ui/Input";
import { Text } from "../ui/Text";

export const InterestConfirmationSheet: React.FC<{
  visible: boolean;
  profile: PublicProfileDto | null;
  note: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ visible, profile, note, busy, onNoteChange, onClose, onConfirm }) => {
  const { palette } = useTheme();
  const styles = useStyles();
  if (!profile) return null;

  const photo = profile.photos.find((item) => item.isPrimary) ?? profile.photos[0];
  const firstName = profile.displayName.trim().split(/\s+/)[0] || profile.displayName;

  return (
    <CenterDialog
      visible={visible}
      onClose={busy ? () => undefined : onClose}
      accessibilityLabel={`Like ${firstName}`}
      closeAccessibilityLabel="Close Like dialog"
      style={styles.dialog}
    >
      <View style={styles.content}>
        <View style={styles.headingRow}>
          {photo ? (
            <Image source={photo.url} contentFit="cover" style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholder]}>
              <Icon name="user" size={21} color={palette.textMuted} />
            </View>
          )}
          <View style={styles.headingCopy}>
            <Text variant="titleSm">Like {firstName}?</Text>
            <Text variant="caption" color="textSubdued" numberOfLines={1}>
              {profile.compatibility.score}% match
            </Text>
          </View>
          <IconButton
            tone="ghost"
            size={32}
            onPress={onClose}
            disabled={busy}
            accessibilityLabel="Close Like dialog"
          >
            <Icon name="close" size={19} color={palette.textSubdued} />
          </IconButton>
        </View>

        <Input
          value={note}
          onChangeText={onNoteChange}
          placeholder="Add a private intro (optional)"
          helper={note.trim() ? `${note.trim().length}/300` : undefined}
          maxLength={300}
          multiline
          editable={!busy}
          accessibilityLabel={`Private introduction for ${profile.displayName}`}
          containerStyle={styles.input}
        />

        <View style={styles.privacyNote}>
          <Icon name="lock" size={14} color={palette.textSubdued} />
          <Text variant="micro" color="textSubdued" numberOfLines={1} style={styles.privacyCopy}>
            Only {firstName} sees your intro
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={onClose}
            disabled={busy}
            style={styles.action}
          />
          <Button
            label="Like"
            variant="like"
            onPress={onConfirm}
            loading={busy}
            leftIcon={<Icon name="heartFill" size={18} color={palette.alwaysWhite} />}
            style={styles.action}
          />
        </View>
      </View>
    </CenterDialog>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  dialog: { maxWidth: 380 },
  content: {
    gap: spacing.lg,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceSubdued,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  privacyCopy: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: { marginTop: spacing.xs },
  action: {
    flex: 1,
  },
}));
