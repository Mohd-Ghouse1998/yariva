import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/ui/Icon";
import { PetalBackdrop } from "../../components/ui/PetalBackdrop";
import { ScreenFooter } from "../../components/layout/ScreenFooter";
import { useResponsiveLayout } from "../../theme/responsive";
import { useTheme } from "../../theme/ThemeContext";

const AuthKeyboardContext = createContext(false);

export const useAuthKeyboardVisible = () => useContext(AuthKeyboardContext);

/** Retain the responsive warm wash; use Yariva's own mark as the quiet accent. */
const AuthGround: React.FC = () => {
  const { palette, resolved } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.background, overflow: "hidden" }]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="authWarm" cx="0.12" cy="-0.06" rx="1.1" ry="0.72">
            <Stop
              offset="0"
              stopColor={palette.peach}
              stopOpacity={resolved === "dark" ? 0.12 : 0.18}
            />
            <Stop offset="0.72" stopColor={palette.peach} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="authCalm" cx="0.98" cy="0.02" rx="0.9" ry="0.58">
            <Stop
              offset="0"
              stopColor={palette.petalLight}
              stopOpacity={resolved === "dark" ? 0.08 : 0.12}
            />
            <Stop offset="0.72" stopColor={palette.petalLight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authWarm)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authCalm)" />
      </Svg>

      <PetalBackdrop variant="auth" />
    </View>
  );
};

export const AuthScreen: React.FC<{
  children: React.ReactNode;
  onBack?: () => void;
  footer?: React.ReactNode;
  keyboardFooter?: React.ReactNode;
  contentAlign?: "center" | "top";
}> = ({ children, onBack, footer, keyboardFooter, contentAlign = "center" }) => {
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const activeFooter = keyboardVisible ? keyboardFooter : footer;

  return (
    <AuthKeyboardContext.Provider value={keyboardVisible}>
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <AuthGround />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={({ pressed }) => [
                styles.back,
                {
                  left: responsive.screenPadding,
                  backgroundColor: pressed ? palette.surfaceMuted : palette.transparent,
                },
              ]}
            >
              <Icon name="arrowLeft" size={22} color={palette.textPrimary} />
            </Pressable>
          ) : null}

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={[
                styles.content,
                {
                  paddingHorizontal: responsive.screenPadding,
                  paddingVertical: keyboardVisible ? 16 : responsive.shortViewport ? 24 : 32,
                  justifyContent:
                    contentAlign === "top" || (keyboardVisible && !keyboardFooter) ? "flex-start" : "center",
                },
              ]}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.constrained}>{children}</View>
            </ScrollView>
            {activeFooter ? (
              <ScreenFooter divider={false} opaque={false} safeAreaHandled>
                {activeFooter}
              </ScreenFooter>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </AuthKeyboardContext.Provider>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  constrained: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  back: {
    position: "absolute",
    top: 8,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
