import React from "react";
import { Image, View } from "react-native";
import { Icon } from "../../components/ui/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { radius, spacing } from "../../theme/spacing";
import type { BlindPolicy } from "../../types/blind";
import { blindPresentation } from "./blindLogic";

/** Only the server-protected slot may be supplied while blind. Never accepts an original fallback. */
export function VibeBlurContainer({ isBlindVibeActive, interactionCount, effectiveBlindVibePolicy, protectedImageSource, children }: {
  isBlindVibeActive: boolean; interactionCount: number;
  effectiveBlindVibePolicy: Pick<BlindPolicy, "revealThreshold" | "initialBlurRadius">;
  protectedImageSource?: { uri: string; alreadyObscured: boolean };
  children: React.ReactNode;
}) {
  const { palette } = useTheme();
  const presentation = blindPresentation({ isBlindVibeActive, interactionCount, ...effectiveBlindVibePolicy });
  return <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
    <View accessibilityLabel={isBlindVibeActive ? "Photo protected" : "Photos revealed"} style={{ width: 42, height: 42, borderRadius: radius.pill, overflow: "hidden", backgroundColor: palette.surfaceSubdued, alignItems: "center", justifyContent: "center" }}>
      {isBlindVibeActive && protectedImageSource ? <Image source={{ uri: protectedImageSource.uri }} blurRadius={protectedImageSource.alreadyObscured ? 0 : presentation.blurRadius} style={{ position: "absolute", width: 42, height: 42 }} /> : null}
      <Icon name={isBlindVibeActive ? "lock" : "eye"} size={18} color={palette.brand} />
    </View>
    <View style={{ flex: 1 }}>{children}</View>
  </View>;
}
