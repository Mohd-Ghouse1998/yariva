import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StepHeader } from "../../components/profile/StepHeader";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";

type Props = {
  title: string;
  subtitle?: string;
  step?: number;
  total?: number;
  contextLabel?: string;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
};

export const ProfileSectionLoadState: React.FC<Props> = ({
  title,
  subtitle,
  step,
  total,
  contextLabel,
  loading,
  error,
  onBack,
  onRetry,
}) => {
  const { palette } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1 }}>
        <StepHeader
          step={step}
          total={total}
          contextLabel={contextLabel}
          title={title}
          subtitle={subtitle}
          onBack={onBack}
        />
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
          accessibilityLiveRegion="polite"
        >
          {loading ? (
            <>
              <ActivityIndicator color={palette.brandStrong} />
              <Text variant="body" color="textSubdued">
                Loading your saved details…
              </Text>
            </>
          ) : (
            <>
              <Text variant="bodyStrong" align="center">
                We couldn’t load your saved details.
              </Text>
              <Text variant="caption" color="textSubdued" align="center">
                {error ?? "Check your connection and try again."}
              </Text>
              <Button label="Try again" variant="secondary" onPress={onRetry} />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};
