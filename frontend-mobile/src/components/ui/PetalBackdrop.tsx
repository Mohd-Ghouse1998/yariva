import React from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

// Transparent single-petal crops of the approved Yariva mark. Keep these as
// decoration only; navigation and content icons retain their own meaning.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uprightPetal = require("../../../assets/brand/match-petal-upright.png");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const curvedPetal = require("../../../assets/brand/match-petal-curved.png");

export type PetalBackdropVariant = "splash" | "welcome" | "auth" | "authHero" | "onboarding" | "celebration" | "discoverCard";

type PetalPlacement = {
  shape: "upright" | "curved";
  size: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  rotation: string;
  opacity: number;
};

export const PetalBackdrop: React.FC<{ variant: PetalBackdropVariant }> = ({ variant }) => {
  const { resolved } = useTheme();
  const { width, height } = useWindowDimensions();
  const edgeSize = Math.min(width * 0.32, 132);
  const celebrationSize = Math.min(width * 0.29, 105);
  const placements: Record<PetalBackdropVariant, PetalPlacement[]> = {
    // Match the Android pre-React launch layer exactly; the launch canvas is
    // intentionally ivory in both theme modes.
    splash: [
      { shape: "upright", size: 152, top: 16, right: -58, rotation: "17deg", opacity: 0.32 },
      { shape: "curved", size: 130, bottom: 20, left: -50, rotation: "-18deg", opacity: 0.28 },
    ],
    welcome: [
      { shape: "upright", size: edgeSize * 0.7, top: 48, right: -edgeSize * 0.45, rotation: "18deg", opacity: 0.12 },
    ],
    auth: [
      { shape: "upright", size: edgeSize * 0.65, top: 58, right: -edgeSize * 0.48, rotation: "20deg", opacity: 0.1 },
    ],
    authHero: [
      { shape: "upright", size: edgeSize * 0.5, bottom: -14, right: -20, rotation: "-32deg", opacity: 0.12 },
    ],
    onboarding: [
      { shape: "upright", size: edgeSize * 0.6, top: 86, right: -edgeSize * 0.44, rotation: "24deg", opacity: 0.1 },
    ],
    celebration: [
      { shape: "upright", size: celebrationSize, top: Math.max(56, height * 0.16), right: -celebrationSize * 0.46, rotation: "14deg", opacity: 0.38 },
      { shape: "curved", size: celebrationSize * 0.82, top: height * 0.44, left: -celebrationSize * 0.38, rotation: "-18deg", opacity: 0.3 },
      { shape: "upright", size: celebrationSize * 0.62, bottom: Math.max(230, height * 0.42), right: -celebrationSize * 0.16, rotation: "34deg", opacity: 0.26 },
    ],
    discoverCard: [],
  };
  const opacityFactor = variant === "splash" || resolved === "light" ? 1 : 0.62;

  return (
    <View pointerEvents="none" style={[styles.backdrop, variant === "discoverCard" && styles.overflowingBackdrop]} accessible={false}>
      {placements[variant].map((petal, index) => (
        <Image
          key={`${petal.shape}-${index}`}
          source={petal.shape === "upright" ? uprightPetal : curvedPetal}
          resizeMode="contain"
          accessible={false}
          style={{
            position: "absolute",
            width: petal.size,
            height: petal.size,
            top: petal.top,
            right: petal.right,
            bottom: petal.bottom,
            left: petal.left,
            opacity: petal.opacity * opacityFactor,
            transform: [{ rotate: petal.rotation }],
          }}
        />
      ))}
    </View>
  );
};

export const PetalEmptyAccent: React.FC = () => {
  const { resolved } = useTheme();
  return (
    <Image
      source={uprightPetal}
      resizeMode="contain"
      accessible={false}
      style={[styles.emptyAccent, { opacity: resolved === "dark" ? 0.25 : 0.35 }]}
    />
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  overflowingBackdrop: { overflow: "visible" },
  emptyAccent: {
    width: 76,
    height: 76,
  },
});
