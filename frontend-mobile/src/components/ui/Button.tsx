import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useResponsiveLayout } from "../../theme/responsive";
import { controlSize, radius, spacing } from "../../theme/spacing";
import { useTheme } from "../../theme/ThemeContext";
import { Text } from "./Text";

// "destructive" is kept as an alias for "danger" for backwards compatibility.
export type ButtonVariant =
  "primary" | "interest" | "secondary" | "ghost" | "like" | "danger" | "destructive" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth,
  style,
  hitSlop,
  accessibilityLabel,
  ...rest
}) => {
  const { palette } = useTheme();
  const layout = useResponsiveLayout();
  const visualHeight = size === "sm" ? layout.buttonSmallHeight : layout.buttonHeight;
  const horizontalPadding = size === "sm" ? 10 : layout.buttonHorizontalPadding;
  const labelSize = size === "sm" ? 12.5 : layout.buttonLabelSize;
  const isDisabled = disabled || loading;
  const danger = variant === "danger" || variant === "destructive";
  const verticalSlop = Math.max(0, Math.ceil((controlSize.minimumTouchTarget - visualHeight) / 2));
  const accessibleHitSlop = hitSlop ?? { top: verticalSlop, bottom: verticalSlop };

  const skin = (pressed: boolean) => {
    if (variant === "primary") {
      return {
        backgroundColor: pressed ? palette.brandDeep : palette.brandStrong,
        borderColor: palette.transparent,
        borderWidth: 0,
        textColor: "textOnBrand" as const,
      };
    }
    if (variant === "interest") {
      return {
        backgroundColor: pressed ? palette.ctaEnd : palette.ctaStart,
        borderColor: palette.transparent,
        borderWidth: 0,
        textColor: "ctaText" as const,
      };
    }
    if (variant === "like") {
      return {
        backgroundColor: palette.like,
        borderColor: palette.transparent,
        borderWidth: 0,
        textColor: "alwaysWhite" as const,
      };
    }
    if (danger) {
      return {
        backgroundColor: pressed ? palette.errorSubdued : palette.surface,
        borderColor: palette.error,
        borderWidth: StyleSheet.hairlineWidth * 2,
        textColor: "error" as const,
      };
    }
    if (variant === "secondary" || variant === "outline") {
      return {
        backgroundColor: pressed ? palette.surfaceMuted : palette.surface,
        borderColor: palette.borderStrong,
        borderWidth: StyleSheet.hairlineWidth * 2,
        textColor: "textPrimary" as const,
      };
    }
    return {
      backgroundColor: pressed ? palette.brandSubdued : palette.transparent,
      borderColor: palette.transparent,
      borderWidth: 0,
      textColor: "textPrimary" as const,
    };
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={accessibleHitSlop}
      disabled={isDisabled}
      style={({ pressed }) => {
        const visualSkin = skin(pressed && !isDisabled);
        return [
          styles.shell,
          {
            backgroundColor: visualSkin.backgroundColor,
            borderColor: visualSkin.borderColor,
            borderWidth: visualSkin.borderWidth,
            minHeight: visualHeight,
            paddingHorizontal: horizontalPadding,
            paddingVertical: 4,
            opacity: disabled ? 0.38 : variant === "like" && pressed ? 0.84 : 1,
            alignSelf: fullWidth ? "stretch" : "auto",
          },
          style,
        ];
      }}
      {...rest}
    >
      {({ pressed }) => {
        const { textColor } = skin(pressed && !isDisabled);
        return (
          <>
            {variant === "interest" ? (
              <LinearGradient
                pointerEvents="none"
                colors={pressed && !isDisabled
                  ? [palette.ctaEnd, palette.ctaStart]
                  : [palette.ctaStart, palette.ctaEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.primaryGradient}
              />
            ) : null}
            <View
              // Keep this native wrapper mounted while opacity changes. Fabric can otherwise
              // flatten/unflatten it mid-navigation and attempt to re-parent the label twice.
              collapsable={false}
              style={{ opacity: loading ? 0 : 1 }}
            >
              <ButtonContent
                label={label}
                fontSize={labelSize}
                color={textColor}
                leftIcon={leftIcon}
                rightIcon={rightIcon}
              />
            </View>
            {loading ? (
              <View pointerEvents="none" style={styles.loading}>
                <ActivityIndicator color={palette[textColor]} />
              </View>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
};

const ButtonContent: React.FC<{
  label: string;
  fontSize: number;
  color: "ctaText" | "textOnBrand" | "textPrimary" | "alwaysWhite" | "error";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}> = ({ label, fontSize, color, leftIcon, rightIcon }) => (
  <View style={styles.row}>
    {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
    <Text
      variant="button"
      color={color}
      numberOfLines={2}
      maxFontSizeMultiplier={1.3}
      style={{ fontSize, textAlign: "center", flexShrink: 1 }}
    >
      {label}
    </Text>
    {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  shell: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
  },
  primaryGradient: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.button,
  },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  icon: {
    marginHorizontal: spacing.xxs,
  },
});

export const ButtonRow: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => {
  const layout = useResponsiveLayout();
  return (
    <View
      style={[
        { flexDirection: layout.stackButtonRow ? "column" : "row", gap: layout.buttonRowGap },
        style,
      ]}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? (
          <View style={{ flex: layout.stackButtonRow ? undefined : 1 }}>{child}</View>
        ) : (
          child
        ),
      )}
    </View>
  );
};
