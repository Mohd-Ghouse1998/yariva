import React, { useState } from "react";
import { Image, type StyleProp, type ViewStyle, View } from "react-native";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { radius } from "../../theme/spacing";
import { Icon } from "../ui/Icon";

type Props = {
  photoUrl?: string | null;
  category?: string | null;
  style?: StyleProp<ViewStyle>;
};

/** A reviewed place may not have licensed photography yet. Keep the same layout without inventing a venue photo. */
export const VenueArtwork: React.FC<Props> = ({ photoUrl, category, style }) => {
  const styles = useStyles();
  const { palette } = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const icon = category === "CAFE" ? "cafe" : category === "RESTAURANT" ? "restaurant" : "location";

  return (
    <View style={[styles.frame, style]}>
      {photoUrl && photoUrl !== failedUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailedUrl(photoUrl)}
          accessibilityLabel="Place photo"
        />
      ) : (
        <Icon name={icon} size={24} color={palette.brandStrong} />
      )}
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  frame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  image: { width: "100%", height: "100%" },
}));
