import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export interface NavigationListRowProps {
  icon?: IconName;
  label: string;
  meta?: string;
  value?: string;
  danger?: boolean;
  disabled?: boolean;
  first?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  labelLines?: number;
  metaLines?: number;
  selected?: boolean;
  selectionRole?: "radio" | "checkbox";
}

/**
 * Compact, responsive navigation row ported from mobile_app_v3's ListRow.
 * Keeping it shared prevents Profile and Settings from drifting apart.
 */
export const NavigationListRow: React.FC<NavigationListRowProps> = ({
  icon,
  label,
  meta,
  value,
  danger = false,
  disabled = false,
  first = false,
  onPress,
  chevron = Boolean(onPress),
  accessibilityLabel,
  labelLines = 2,
  metaLines = 1,
  selected,
  selectionRole = "radio",
}) => {
  const { palette } = useTheme();

  const content = (
    <>
      {icon ? (
        <View
          style={[
            styles.iconTile,
            { backgroundColor: danger ? palette.errorSubdued : palette.brandSubdued },
          ]}
        >
          <Icon name={icon} size={15} color={danger ? palette.error : palette.textBrand} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text
          variant="bodyStrong"
          color={danger ? "error" : "textPrimary"}
          numberOfLines={labelLines}
          style={styles.label}
        >
          {label}
        </Text>
        {meta ? (
          <Text variant="caption" color="textSubdued" numberOfLines={metaLines} style={styles.meta}>
            {meta}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          variant="caption"
          color="textSubdued"
          numberOfLines={2}
          style={{ maxWidth: "45%", flexShrink: 1, textAlign: "right" }}
        >
          {value}
        </Text>
      ) : null}
      {selected !== undefined ? (
        <View
          style={[
            styles.selection,
            {
              backgroundColor: selected ? palette.brandStrong : palette.transparent,
              borderColor: selected ? palette.brandStrong : palette.borderStrong,
            },
          ]}
        >
          {selected ? <Icon name="check" size={12} color={palette.textOnBrand} /> : null}
        </View>
      ) : chevron ? (
        <Icon name="chevronRight" size={16} color={palette.textSubdued} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    {
      borderTopColor: palette.divider,
      borderTopWidth: first ? 0 : StyleSheet.hairlineWidth * 2,
      opacity: disabled ? 0.52 : 1,
    },
  ];

  if (!onPress || disabled) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel ?? [label, meta, value].filter(Boolean).join(", ")}
        accessibilityState={{ disabled }}
        style={rowStyle}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={selected === undefined ? "button" : selectionRole}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed ? { backgroundColor: palette.surfaceTint } : null]}
    >
      {content}
    </Pressable>
  );
};

export const NavigationListSection: React.FC<{
  label?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ label, children, style }) => (
  <View style={[styles.section, style]}>
    {label ? (
      <Text variant="micro" color="textSubdued" weight="600" style={styles.sectionLabel}>
        {label}
      </Text>
    ) : null}
    <Card padded={false}>{children}</Card>
  </View>
);

const styles = StyleSheet.create({
  section: {
    gap: 7,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  selection: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
  meta: {
    marginTop: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
