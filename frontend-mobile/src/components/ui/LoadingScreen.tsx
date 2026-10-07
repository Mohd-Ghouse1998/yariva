import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export const LoadingScreen: React.FC = () => {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.background,
      }}
    >
      <ActivityIndicator color={palette.brand} />
    </View>
  );
};
