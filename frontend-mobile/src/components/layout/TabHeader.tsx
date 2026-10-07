import React from "react";
import { StyleSheet, View } from "react-native";
import { controlSize, spacing } from "../../theme/spacing";
import { useResponsiveLayout } from "../../theme/responsive";
import { useTheme } from "../../theme/ThemeContext";
import { Text } from "../ui/Text";

/** Shared centred title treatment for Yariva's five top-level destinations. */
export interface TabHeaderProps {
  title: string;
  center?: React.ReactNode;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export const TabHeader: React.FC<TabHeaderProps> = ({ title, center, subtitle, left, right }) => {
  const { palette } = useTheme();
  const responsive = useResponsiveLayout();

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.background, paddingHorizontal: responsive.screenPadding },
      ]}
    >
      <View testID="tab-header-row" style={styles.row}>
        <View style={[styles.side, styles.sideStart]}>{left}</View>
        <View style={styles.titleSlot}>
          {center ?? (
            <Text
              variant="titleSm"
              align="center"
              numberOfLines={1}
              accessibilityRole="header"
              style={styles.title}
            >
              {title}
            </Text>
          )}
        </View>
        <View style={[styles.side, styles.sideEnd]}>{right}</View>
      </View>
      {subtitle ? (
        <Text
          variant="caption"
          color="textSubdued"
          align="center"
          numberOfLines={2}
          style={styles.subtitle}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  row: {
    position: "relative",
    minHeight: controlSize.minimumTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  side: {
    zIndex: 1,
    minWidth: controlSize.minimumTouchTarget,
    minHeight: controlSize.minimumTouchTarget,
    maxWidth: "34%",
    flexGrow: 1,
    flexBasis: 0,
    justifyContent: "center",
  },
  sideStart: { alignItems: "flex-start" },
  sideEnd: { alignItems: "flex-end" },
  titleSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    maxWidth: "48%",
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.45,
  },
  subtitle: {
    alignSelf: "center",
    maxWidth: 520,
    marginTop: 1,
    paddingHorizontal: 44,
    fontSize: 12,
    lineHeight: 17,
  },
});
