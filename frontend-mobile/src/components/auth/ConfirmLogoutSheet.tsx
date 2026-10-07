import React from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { BottomSheet } from "../ui/BottomSheet";
import { Button, ButtonRow } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Text } from "../ui/Text";

export const ConfirmLogoutSheet: React.FC<{
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ visible, busy = false, onClose, onConfirm }) => {
  const { palette } = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={() => !busy && onClose()}
      heightFraction={0.34}
      accessibilityLabel="Confirm log out"
    >
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: palette.surfaceTint }]}>
          <Icon name="logout" size={20} color={palette.textSecondary} />
        </View>
        <Text variant="titleSm">Log out?</Text>
        <Text variant="body" color="textSubdued">
          You’ll need to sign in again to use Yariva on this device.
        </Text>
        <View style={styles.actions}>
          <ButtonRow>
            <Button label="Cancel" variant="secondary" disabled={busy} onPress={onClose} />
            <Button label="Log out" variant="danger" loading={busy} onPress={onConfirm} />
          </ButtonRow>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    marginTop: "auto",
  },
});
