import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Icon } from "../../components/ui/Icon";
import { IconButton } from "../../components/ui/IconButton";
import { Text } from "../../components/ui/Text";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { spacing } from "../../theme/spacing";
import type { PublicProfileDto } from "../../types/profile";

interface DuoMembersDialogProps {
  visible: boolean;
  members: PublicProfileDto[];
  label?: string;
  currentUserId?: string;
  onClose: () => void;
  onReport: (member: PublicProfileDto) => void;
  onBlock: (member: PublicProfileDto) => void;
}

/** One member list, with safety actions disclosed only for the selected person. */
export const DuoMembersDialog: React.FC<DuoMembersDialogProps> = ({
  visible,
  members,
  label = "Duo chat members",
  currentUserId,
  onClose,
  onReport,
  onBlock,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { palette } = useTheme();
  const styles = useStyles();
  useEffect(() => {
    if (!visible) setSelectedId(null);
  }, [visible]);
  const selected = members.find(
    (member) => member.userId === selectedId && member.userId !== currentUserId,
  );

  return (
    <CenterDialog
      visible={visible}
      onClose={onClose}
      accessibilityLabel={label}
      style={styles.dialog}
    >
      <View style={styles.header}>
        <Text variant="subheading" style={styles.title}>
          Members & safety
        </Text>
        <IconButton
          size={36}
          tone="neutral"
          onPress={onClose}
          accessibilityLabel="Close members and safety"
        >
          <Icon name="x" size={18} />
        </IconButton>
      </View>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          const isSelected = member.userId === selectedId && !isSelf;
          return (
            <Pressable
              key={member.userId}
              accessibilityRole="button"
              accessibilityLabel={isSelf ? `${member.displayName}, You` : `Safety options for ${member.displayName}`}
              accessibilityState={{ selected: isSelected, disabled: isSelf }}
              disabled={isSelf}
              onPress={() => setSelectedId((id) => (id === member.userId ? null : member.userId))}
              style={({ pressed }) => [styles.memberRow, isSelected ? styles.selectedRow : null, pressed ? styles.pressedRow : null]}
            >
              <Icon name="user" size={18} color={isSelected ? palette.textBrand : palette.textSecondary} />
              <Text variant="body" style={styles.memberName}>{member.displayName}</Text>
              {isSelf ? <Text variant="caption" color="textSubdued">You</Text> : null}
            </Pressable>
          );
        })}
        {selected ? (
          <View style={styles.safetyActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Report ${selected.displayName}`} onPress={() => onReport(selected)} style={({ pressed }) => [styles.actionRow, pressed ? styles.pressedRow : null]}>
              <Icon name="flag" size={18} color={palette.textSecondary} />
              <Text variant="body">Report {selected.displayName}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Block ${selected.displayName}`} onPress={() => onBlock(selected)} style={({ pressed }) => [styles.actionRow, pressed ? styles.pressedRow : null]}>
              <Icon name="block" size={18} color={palette.error} />
              <Text variant="body" color="error">Block {selected.displayName}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </CenterDialog>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  dialog: { gap: spacing.xs, padding: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, minWidth: 0 },
  scroll: { flexShrink: 1 },
  memberRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  memberName: { flex: 1 },
  selectedRow: { backgroundColor: palette.brandSubdued },
  pressedRow: { backgroundColor: palette.surfaceTint },
  safetyActions: { borderTopWidth: 1, borderTopColor: palette.divider, marginTop: spacing.xs, paddingTop: spacing.xs },
  actionRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.sm, borderRadius: 12 },
}));
