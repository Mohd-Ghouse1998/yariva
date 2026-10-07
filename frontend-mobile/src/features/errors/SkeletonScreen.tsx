import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArohaMark } from "../../components/ui/ArohaMark";
import { Skeleton } from "../../components/ui/Skeleton";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";

// Mirrors aroha_ui_deisgn_files/profile-settings.jsx > ScreenSkeleton.
// Used as the pre-data placeholder while Discover is loading.
export const SkeletonScreen: React.FC = () => {
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <ArohaMark size={32} />
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <View style={styles.cardSkeleton}>
            <View style={styles.bottomBlock}>
              <Skeleton width="40%" height={22} />
              <View style={{ height: 10 }} />
              <Skeleton width="80%" height={12} />
              <View style={{ height: 6 }} />
              <Skeleton width="60%" height={12} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  cardSkeleton: {
    width: "100%",
    aspectRatio: 0.72,
    borderRadius: 26,
    backgroundColor: palette.surfaceMuted,
    overflow: "hidden",
    position: "relative",
  },
  bottomBlock: {
    position: "absolute",
    bottom: 22,
    left: 22,
    right: 22,
  },
}));
