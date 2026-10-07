import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../components/ui/Text";
import { YarivaMark, YarivaWordmark } from "../../components/ui/YarivaBrand";
import { useResponsiveLayout } from "../../theme/responsive";
import { spacing } from "../../theme/spacing";
import { useAuthKeyboardVisible } from "./AuthScreen";

/** The approved petal artwork and original wordmark introduce password sign-in. */
export const AuthBrandHeader: React.FC<{ title?: string; description?: string }> = ({ title, description }) => {
  const { shortViewport, accessibilityLayout } = useResponsiveLayout();
  const keyboardVisible = useAuthKeyboardVisible();
  const compact = shortViewport || accessibilityLayout;

  return (
    <View>
      {!keyboardVisible ? (
        <View style={[styles.brand, { gap: compact ? spacing.xs : spacing.sm }]}>
          <YarivaMark size={compact ? 92 : 144} accessibilityLabel="Yariva petal mark" />
          <YarivaWordmark size={compact ? 35 : 48} />
          <Text variant="micro" color="textSubdued" align="center" style={styles.tagline}>
            SAME VIBES. BRIGHTER DAYS.
          </Text>
        </View>
      ) : null}
      {title ? (
        <Text
          variant="authTitle"
          accessibilityRole="header"
          style={{ marginTop: keyboardVisible ? spacing.sm : compact ? spacing.xl : spacing.xxxl }}
        >
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text variant="bodyLarge" color="textSubdued" style={{ marginTop: spacing.xs }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
  },
  tagline: {
    letterSpacing: 2.2,
  },
});
