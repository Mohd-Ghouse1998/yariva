import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { radius } from "../../theme/spacing";
import { shadows } from "../../theme/shadows";
import { useTheme } from "../../theme/ThemeContext";

// Shared flat surface. Use elevation only when hierarchy genuinely needs it.
export interface CardProps extends ViewProps {
  elevated?: boolean;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  elevated = false,
  padded = true,
  style,
  children,
  ...rest
}) => {
  const { palette } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { backgroundColor: palette.surface, borderColor: palette.borderStrong },
        padded ? styles.padded : null,
        elevated ? shadows.md : null,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  padded: {
    padding: 13,
  },
});
