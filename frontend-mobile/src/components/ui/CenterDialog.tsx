import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import { shadows } from "../../theme/shadows";
import { useReducedMotion } from "../../theme/useReducedMotion";

export interface CenterDialogProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
  closeAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  keyboardAware?: boolean;
}

/** Shared compact modal used for short choices that belong in the center viewport. */
export const CenterDialog: React.FC<CenterDialogProps> = ({
  visible,
  onClose,
  children,
  accessibilityLabel = "Dialog",
  closeAccessibilityLabel = "Close dialog",
  style,
  keyboardAware = false,
}) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        enabled={keyboardAware}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.frame,
          {
            paddingTop: Math.max(insets.top, spacing.xl),
            paddingBottom: Math.max(insets.bottom, spacing.xl),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeAccessibilityLabel}
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: palette.overlayDark }]}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          importantForAccessibility="yes"
          onAccessibilityEscape={onClose}
          style={[
            styles.dialog,
            shadows.lg,
            { backgroundColor: palette.surface, borderColor: palette.borderStrong },
            style,
          ]}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "100%",
    borderRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
  },
});
