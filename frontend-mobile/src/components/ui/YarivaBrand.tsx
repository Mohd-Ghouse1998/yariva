import React from "react";
import { Image, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export interface YarivaBrandProps {
  size?: number;
  accessibilityLabel?: string;
  appearance?: "light" | "dark";
}

// Transparent cutout of the petals in the user's supplied logo artwork.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const petalSource = require("../../../assets/brand/petal-artwork.png");
// Exact cropped lettering from assets/yariva-wordmark.png, recolored by the
// brand generator so only the orange dot changes with the petal identity.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wordmarkLightSource = require("../../../assets/brand/wordmark-light.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wordmarkDarkSource = require("../../../assets/brand/wordmark-dark.png");
const wordmarkAspectRatio = 999 / 315;

/**
 * The supplied textured petal artwork is used in-app and to render native
 * launcher/splash exports. Do not replace it with a geometric approximation.
 */
export const YarivaMark: React.FC<YarivaBrandProps> = ({
  size = 40,
  accessibilityLabel = "Yariva",
}) => {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Image accessible={false} source={petalSource} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
  );
};

/**
 * Preserve the user's original Yariva letterform at header and auth sizes.
 */
export const YarivaWordmark: React.FC<YarivaBrandProps> = ({
  size = 30,
  accessibilityLabel = "Yariva",
  appearance,
}) => {
  const { resolved } = useTheme();
  const width = Math.round(size * wordmarkAspectRatio);
  const source = (appearance ?? resolved) === "dark" ? wordmarkDarkSource : wordmarkLightSource;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height: size }}
    >
      <Image accessible={false} source={source} resizeMode="contain" style={{ width, height: size }} />
    </View>
  );
};
