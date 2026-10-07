import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/ThemeContext";

export const SettingsLoadState: React.FC<{
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}> = ({ loading, error, onRetry }) => {
  const { palette } = useTheme();
  if (!loading && !error) return null;
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
      accessibilityRole={loading ? "progressbar" : undefined}
    >
      {loading ? (
        <>
          <ActivityIndicator color={palette.brandStrong} />
          <Text variant="body" color="textSubdued" style={{ marginTop: 12 }}>
            Loading settings…
          </Text>
        </>
      ) : (
        <>
          <Icon name="warning" size={28} color={palette.error} />
          <Text variant="subheading" align="center" style={{ marginTop: 12 }}>
            Settings couldn’t load
          </Text>
          <Text variant="body" color="textSubdued" align="center" style={{ marginTop: 6 }}>
            Nothing was changed. Check your connection and retry.
          </Text>
          <Button label="Retry" variant="secondary" onPress={onRetry} style={{ marginTop: 20 }} />
        </>
      )}
    </View>
  );
};
