import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { useReducedMotion } from "../../theme/useReducedMotion";

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heightFraction?: number;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  heightFraction = 0.55,
  scrollable = false,
  contentContainerStyle,
  accessibilityLabel = "Dialog",
}) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const height = screen.height * Math.max(0.3, Math.min(heightFraction, 0.95));
  const [mounted, setMounted] = useState(visible);
  const translate = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    if (reducedMotion) {
      translate.setValue(visible ? 0 : height);
      if (!visible) setMounted(false);
      return;
    }
    if (visible) {
      translate.setValue(height);
      const animation = Animated.timing(translate, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }
    const animation = Animated.timing(translate, {
      toValue: height,
      duration: 200,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => animation.stop();
  }, [height, mounted, reducedMotion, translate, visible]);

  const content = scrollable ? (
    <ScrollView
      style={styles.content}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentContainerStyle]}>{children}</View>
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: palette.overlayDark }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          importantForAccessibility="yes"
          onAccessibilityEscape={onClose}
          style={[
            styles.sheet,
            {
              height,
              paddingBottom: Math.max(insets.bottom, spacing.xxl),
              backgroundColor: palette.surface,
              borderColor: palette.borderStrong,
              transform: [{ translateY: translate }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: palette.borderStrong }]} />
          {content}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  content: {
    flex: 1,
  },
});
