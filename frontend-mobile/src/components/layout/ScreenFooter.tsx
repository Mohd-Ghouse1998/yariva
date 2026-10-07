import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";

/** Shared sticky action area adapted from mobile_app_v3. */
export const ScreenFooter: React.FC<{
  children: React.ReactNode;
  divider?: boolean;
  opaque?: boolean;
  safeAreaHandled?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ children, divider = true, opaque = true, safeAreaHandled = false, style }) => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.footer,
        {
          paddingHorizontal: layout.screenPadding,
          paddingBottom: safeAreaHandled ? spacing.sm : Math.max(insets.bottom, spacing.md),
          borderTopWidth: divider ? StyleSheet.hairlineWidth * 2 : 0,
          borderTopColor: palette.borderSubdued,
          backgroundColor: opaque ? palette.background : palette.transparent,
        },
        style,
      ]}
    >
      <View style={[styles.action, { maxWidth: layout.actionMaxWidth }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingTop: spacing.md,
  },
  action: {
    width: "100%",
    alignSelf: "center",
  },
});
