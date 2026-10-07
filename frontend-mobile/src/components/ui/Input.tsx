import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { controlSize, radius } from "../../theme/spacing";
import { fontFamilies } from "../../theme/typography";
import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label?: string;
  helper?: string;
  error?: string | null;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  controlStyle?: ViewStyle;
  multiline?: boolean;
}

// One responsive field treatment shared by every form. Its resting 46dp
// surface matches the v3 reference but uses minHeight so larger text can grow.
export const Input: React.FC<InputProps> = ({
  label,
  helper,
  error,
  leftIcon,
  rightIcon,
  containerStyle,
  controlStyle,
  multiline,
  ...rest
}) => {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? palette.error : focused ? palette.borderFocus : palette.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="fieldLabel" color="textSubdued" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={styles.glowWrap}>
        <View
          style={[
            styles.inputWrap,
            { borderColor, backgroundColor: palette.surface },
            controlStyle,
            multiline ? styles.multilineWrap : null,
          ]}
        >
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <TextInput
            {...rest}
            accessibilityLabel={rest.accessibilityLabel ?? label}
            accessibilityHint={rest.accessibilityHint ?? (error || helper || undefined)}
            style={[
              styles.input,
              { color: palette.textPrimary },
              multiline ? styles.inputMultiline : null,
              rest.style,
            ]}
            placeholderTextColor={rest.placeholderTextColor ?? palette.textPlaceholder}
            maxFontSizeMultiplier={rest.maxFontSizeMultiplier ?? 1.5}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            multiline={multiline}
          />
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      </View>
      {error ? (
        <Text
          variant="caption"
          color="error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ marginTop: 6 }}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="textSubdued" style={{ marginTop: 6 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    marginBottom: 5,
  },
  glowWrap: {
    borderRadius: radius.control,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    minHeight: controlSize.input,
  },
  multilineWrap: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  iconLeft: { marginRight: 10 },
  iconRight: { marginLeft: 10 },
  input: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    letterSpacing: -0.1,
    paddingVertical: 6,
  },
  inputMultiline: {
    minHeight: 88,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
});

// Field wrapper — kept available for screens that want to compose label/hint
// outside the Input itself. Matches the Figma Field component.
export const Field: React.FC<{
  label?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}> = ({ label, hint, error, children }) => (
  <View style={{ width: "100%", gap: 6 }}>
    {label ? (
      <Text variant="fieldLabel" color="textSubdued" style={[styles.label, { marginBottom: 0 }]}>
        {label}
      </Text>
    ) : null}
    {children}
    {hint || error ? (
      <Text variant="caption" color={error ? "error" : "textSubdued"}>
        {error ?? hint}
      </Text>
    ) : null}
  </View>
);
