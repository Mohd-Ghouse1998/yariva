import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Palette } from "../../theme/colors";
import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { ScreenFooter } from "./ScreenFooter";
import { PetalBackdrop, type PetalBackdropVariant } from "../ui/PetalBackdrop";

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  background?: keyof Palette;
  edges?: Array<"top" | "right" | "bottom" | "left">;
  keyboardAvoiding?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  bottomBar?: React.ReactNode;
  keyboardVerticalOffset?: number;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle" | "children">;
  decoration?: PetalBackdropVariant;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = false,
  padded = true,
  background = "background",
  edges = ["top", "left", "right"],
  keyboardAvoiding = false,
  contentStyle,
  bottomBar,
  keyboardVerticalOffset = 0,
  scrollProps,
  decoration,
}) => {
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const includesBottomEdge = edges.includes("bottom");
  const contentBottomInset = bottomBar
    ? spacing.xl
    : spacing.huge + (includesBottomEdge ? 0 : insets.bottom);
  const containerStyle = {
    flex: 1,
    backgroundColor: palette[background],
  };

  const inner = scroll ? (
    <ScrollView
      {...scrollProps}
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.scrollGrow,
        padded
          ? [styles.padded, styles.constrained, { paddingHorizontal: responsive.screenPadding }]
          : null,
        { paddingBottom: contentBottomInset },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        { flex: 1 },
        padded
          ? [styles.padded, styles.constrained, { paddingHorizontal: responsive.screenPadding }]
          : null,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const footer = bottomBar ? (
    <ScreenFooter safeAreaHandled={includesBottomEdge}>{bottomBar}</ScreenFooter>
  ) : null;

  const body = (
    <>
      {inner}
      {footer}
    </>
  );

  const content = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView edges={edges} style={[containerStyle, decoration ? styles.decorated : null]}>
      {decoration ? <PetalBackdrop variant={decoration} /> : null}
      {content}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  decorated: { overflow: "hidden" },
  scrollGrow: {
    flexGrow: 1,
  },
  padded: {
    width: "100%",
  },
  constrained: {
    maxWidth: 720,
    alignSelf: "center",
  },
});
