import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { isProtectedPhotoSource } from "../../features/blind/protectedPhoto";

export interface AvatarProps {
  uri?: string | null;
  initials?: string;
  size?: number;
  ring?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, initials, size = 48, ring = false }) => {
  const { palette } = useTheme();
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring ? 2 : 0,
    borderColor: palette.brand,
  };

  if (isProtectedPhotoSource(uri)) return <View accessibilityLabel="Photo protected" style={[styles.container, styles.fallback, containerStyle, { backgroundColor: palette.surfaceSubdued }]}><Icon name="lock" size={Math.min(18, size / 2)} color={palette.brand} /></View>;
  if (uri) {
    return (
      <View style={[styles.container, { backgroundColor: palette.surfaceSubdued }, containerStyle]}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        styles.fallback,
        { backgroundColor: palette.brandStrong },
        containerStyle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text variant="bodyStrong" color="textOnBrand">
        {(initials ?? "·").slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
