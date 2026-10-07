import { Platform } from "react-native";

const sansRegular = Platform.select({
  ios: "Inter_400Regular",
  android: "Inter_400Regular",
  default: "System",
});

const sansMedium = Platform.select({
  ios: "Inter_500Medium",
  android: "Inter_500Medium",
  default: "System",
});

const sansSemiBold = Platform.select({
  ios: "Inter_600SemiBold",
  android: "Inter_600SemiBold",
  default: "System",
});

const displayFamily = Platform.select({
  ios: "SpaceGrotesk_600SemiBold",
  android: "SpaceGrotesk_600SemiBold",
  default: "System",
});

const displayMediumFamily = Platform.select({
  ios: "SpaceGrotesk_500Medium",
  android: "SpaceGrotesk_500Medium",
  default: "System",
});

// A bundled face already carries its weight. Asking Android to apply the same
// weight again can trigger synthetic emboldening; only System needs a weight.
export const systemFontWeight = (weight: "400" | "500" | "600" | "700") =>
  Platform.OS === "web" ? { fontWeight: weight } : {};

export const typography = {
  hero: {
    fontFamily: displayFamily,
    fontSize: 34,
    lineHeight: 40,
    ...systemFontWeight("600"),
    letterSpacing: -0.9,
  },
  display: {
    fontFamily: displayFamily,
    fontSize: 28,
    lineHeight: 34,
    ...systemFontWeight("600"),
    letterSpacing: -0.7,
  },
  authTitle: {
    fontFamily: displayMediumFamily,
    fontSize: 25,
    lineHeight: 32,
    ...systemFontWeight("500"),
    letterSpacing: -0.3,
  },
  photoHeadline: {
    fontFamily: displayMediumFamily,
    fontSize: 20,
    lineHeight: 27,
    ...systemFontWeight("500"),
    letterSpacing: -0.25,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 22,
    lineHeight: 28,
    ...systemFontWeight("600"),
    letterSpacing: -0.45,
  },
  titleSm: {
    fontFamily: displayFamily,
    fontSize: 18,
    lineHeight: 24,
    ...systemFontWeight("600"),
    letterSpacing: -0.3,
  },

  heading: {
    fontFamily: displayFamily,
    fontSize: 17,
    lineHeight: 22,
    ...systemFontWeight("600"),
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    ...systemFontWeight("600"),
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: sansRegular,
    fontSize: 16,
    lineHeight: 24,
    ...systemFontWeight("400"),
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: sansRegular,
    fontSize: 15,
    lineHeight: 22,
    ...systemFontWeight("400"),
  },
  bodyStrong: {
    fontFamily: sansSemiBold,
    fontSize: 15,
    lineHeight: 22,
    ...systemFontWeight("600"),
  },
  caption: {
    fontFamily: sansRegular,
    fontSize: 13,
    lineHeight: 18,
    ...systemFontWeight("400"),
  },
  captionStrong: {
    fontFamily: sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    ...systemFontWeight("600"),
  },
  fieldLabel: {
    fontFamily: sansMedium,
    fontSize: 12,
    lineHeight: 16,
    ...systemFontWeight("500"),
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  micro: {
    fontFamily: sansMedium,
    fontSize: 11,
    lineHeight: 14,
    ...systemFontWeight("500"),
    letterSpacing: 0.4,
  },
  button: {
    fontFamily: sansMedium,
    fontSize: 15,
    lineHeight: 20,
    ...systemFontWeight("500"),
    letterSpacing: -0.1,
  },
};

export const fontFamilies = {
  sans: sansRegular,
  regular: sansRegular,
  medium: sansMedium,
  semiBold: sansSemiBold,
  bold: sansSemiBold,
  display: displayFamily,
  displayMedium: displayMediumFamily,
  serif: displayFamily,
  serifBold: displayFamily,
};

export const fontFamilyForWeight = {
  "400": sansRegular,
  "500": sansMedium,
  "600": sansSemiBold,
  "700": sansSemiBold,
} as const;

export type TypographyToken = keyof typeof typography;
