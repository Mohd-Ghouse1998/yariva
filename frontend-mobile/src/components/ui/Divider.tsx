import React from "react";
import { View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export const Divider: React.FC<{ inset?: number; vertical?: boolean }> = ({
  inset = 0,
  vertical = false,
}) => {
  const { palette } = useTheme();
  return (
    <View
      style={
        vertical
          ? {
              width: 1,
              alignSelf: "stretch",
              backgroundColor: palette.borderSubdued,
              marginHorizontal: inset,
            }
          : { height: 1, backgroundColor: palette.borderSubdued, marginVertical: inset }
      }
    />
  );
};
