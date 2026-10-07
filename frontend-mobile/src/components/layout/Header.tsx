import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { spacing } from "../../theme/spacing";
import { useResponsiveLayout } from "../../theme/responsive";
import { useTheme } from "../../theme/ThemeContext";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Text } from "../ui/Text";

// TopBar from aroha_ui_deisgn_files/ui.jsx — transparent over the cream
// background, centered title, optional left back IconBtn + right slot.
export interface HeaderProps {
  title?: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  onLeftPress?: () => void;
  leftAccessibilityLabel?: string;
  rightSlot?: React.ReactNode;
  centered?: boolean;
  bordered?: boolean;
  large?: boolean;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  leftIcon,
  onLeftPress,
  leftAccessibilityLabel = "Back",
  rightSlot,
  centered = true,
  bordered = false,
  large = false,
  showBack = false,
}) => {
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();
  const left = leftIcon ? (
    onLeftPress ? (
      <Pressable
        onPress={onLeftPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={leftAccessibilityLabel}
      >
        {leftIcon}
      </Pressable>
    ) : (
      leftIcon
    )
  ) : showBack && onLeftPress ? (
    <IconButton onPress={onLeftPress} accessibilityLabel="Back">
      <Icon name="arrowLeft" size={22} color={palette.textPrimary} />
    </IconButton>
  ) : null;

  if (!title && !subtitle && !left && !rightSlot) return null;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.transparent },
        bordered ? { borderBottomColor: palette.borderSubdued, borderBottomWidth: 1 } : null,
      ]}
    >
      <View style={[styles.topRow, { paddingHorizontal: responsive.screenPadding }]}>
        <View style={styles.side}>{left}</View>
        <View style={styles.titleSlot} pointerEvents="none">
          {!large && title ? (
            <Text
              variant="subheading"
              align={centered ? "center" : "left"}
              numberOfLines={1}
              accessibilityRole="header"
              style={styles.title}
            >
              {title}
            </Text>
          ) : null}
        </View>
        <View style={[styles.side, { alignItems: "flex-end" }]}>{rightSlot}</View>
      </View>
      {large && title ? (
        <View style={[styles.largeBlock, { paddingHorizontal: responsive.screenPadding }]}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color="textSubdued" style={{ marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  topRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  side: {
    zIndex: 1,
    width: 56,
    minHeight: 44,
    justifyContent: "center",
  },
  titleSlot: {
    position: "absolute",
    left: 64,
    right: 64,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
  },
  largeBlock: {
    paddingTop: spacing.sm,
  },
});
