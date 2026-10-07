import React from "react";
import { Pressable, View } from "react-native";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";

export const AgeTermsConsent: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
  disabled?: boolean;
}> = ({ checked, onChange, error, disabled = false }) => {
  const { palette } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => onChange(!checked)}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityLabel="I am 18 or older and agree to the terms and privacy policy"
        accessibilityState={{ checked, disabled }}
        style={{
          flexDirection: "row",
          gap: 10,
          alignItems: "flex-start",
          marginTop: 2,
          opacity: disabled ? 0.5 : 1,
        }}
        hitSlop={8}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: checked ? palette.brandStrong : palette.borderStrong,
            backgroundColor: checked ? palette.brandStrong : palette.surface,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          {checked ? (
            <Icon name="check" size={14} color={palette.textOnBrand} strokeWidth={2.5} />
          ) : null}
        </View>
        <Text variant="caption" color="textSubdued" style={{ flex: 1 }}>
          I’m 18 or older and agree to Yariva’s{" "}
          <Text variant="captionStrong" color="textBrand">
            Terms
          </Text>{" "}
          and{" "}
          <Text variant="captionStrong" color="textBrand">
            Privacy Policy
          </Text>
          .
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
};
