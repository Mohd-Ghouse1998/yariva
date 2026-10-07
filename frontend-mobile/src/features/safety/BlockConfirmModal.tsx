import React from "react";
import { ScrollView, View } from "react-native";
import { Button, ButtonRow } from "../../components/ui/Button";
import { CenterDialog } from "../../components/ui/CenterDialog";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { useLocalization } from "../../localization/LocalizationContext";
import { radius, spacing } from "../../theme/spacing";

// The same centered confirmation for Profile, Connections and Chat.
export interface BlockConfirmModalProps {
  visible: boolean;
  displayName: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export const BlockConfirmModal: React.FC<BlockConfirmModalProps> = ({
  visible,
  displayName,
  onConfirm,
  onCancel,
  busy,
}) => {
  const { palette } = useTheme();
  const styles = useStyles();
  const { tone, t } = useLocalization();
  const cancel = () => {
    if (!busy) onCancel();
  };
  return (
    <CenterDialog
      visible={visible}
      onClose={cancel}
      accessibilityLabel={`Block ${displayName}?`}
      style={styles.dialog}
    >
      <View style={styles.header}>
        <View style={styles.iconDisc}>
          <Icon name="block" size={20} color={palette.error} />
        </View>
        <Text variant="subheading" style={styles.title}>
          Block {displayName}?
        </Text>
      </View>
      <ScrollView style={styles.scroll}>
        {tone === "hyderabad-casual" ? (
          <Text variant="caption" color="textSubdued" style={{ marginBottom: spacing.sm }}>
            {t("safety.block.casualCandidate")} · {t("safety.block.action")}
          </Text>
        ) : null}
        <Text variant="body" color="textSubdued">
          They won’t see your profile, message, or call you. We won’t tell them.
        </Text>
      </ScrollView>
      <ButtonRow>
        <Button label="Cancel" variant="secondary" fullWidth disabled={busy} onPress={cancel} />
        <Button
          label={`Block ${displayName}`}
          variant="danger"
          fullWidth
          loading={busy}
          onPress={() => {
            if (!busy) onConfirm();
          }}
        />
      </ButtonRow>
    </CenterDialog>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  dialog: { gap: spacing.md, padding: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, minWidth: 0 },
  scroll: { flexShrink: 1 },
  iconDisc: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    backgroundColor: palette.errorSubdued,
    alignItems: "center",
    justifyContent: "center",
  },
}));
