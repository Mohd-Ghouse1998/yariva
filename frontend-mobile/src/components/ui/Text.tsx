import React from "react";
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
  useWindowDimensions,
} from "react-native";
import type { Palette } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import {
  fontFamilyForWeight,
  systemFontWeight,
  TypographyToken,
  typography,
} from "../../theme/typography";

export interface TextProps extends RNTextProps {
  variant?: TypographyToken;
  color?: keyof Palette;
  align?: "auto" | "left" | "right" | "center" | "justify";
  weight?: "400" | "500" | "600" | "700";
  numberOfLines?: number;
}

const MAX_FONT_SCALE: Record<TypographyToken, number> = {
  hero: 1.4,
  display: 1.45,
  authTitle: 1.6,
  photoHeadline: 1.6,
  title: 1.6,
  titleSm: 1.7,
  heading: 1.8,
  subheading: 1.8,
  bodyLarge: 2,
  body: 2,
  bodyStrong: 2,
  caption: 1.9,
  captionStrong: 1.9,
  fieldLabel: 1.9,
  micro: 1.7,
  button: 1.6,
};

export const Text: React.FC<TextProps> = ({
  variant = "body",
  color = "textPrimary",
  align,
  weight,
  style,
  children,
  allowFontScaling = true,
  maxFontSizeMultiplier,
  ...rest
}) => {
  const { palette } = useTheme();
  const { fontScale } = useWindowDimensions();
  const cap = maxFontSizeMultiplier ?? MAX_FONT_SCALE[variant];
  const lineScale = allowFontScaling ? Math.min(fontScale, cap) : 1;
  const customLineHeight = StyleSheet.flatten(style)?.lineHeight;
  const composed: TextStyle = {
    ...typography[variant],
    color: palette[color],
    ...(align ? { textAlign: align } : null),
    ...(weight ? { fontFamily: fontFamilyForWeight[weight], ...systemFontWeight(weight) } : null),
    lineHeight: (customLineHeight ?? typography[variant].lineHeight) * lineScale,
  };
  return (
    <RNText
      {...rest}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={cap}
      style={StyleSheet.flatten([composed, style, { lineHeight: composed.lineHeight }])}
    >
      {children}
    </RNText>
  );
};
