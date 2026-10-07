import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { PetalBackdrop } from "../../components/ui/PetalBackdrop";
import geometry from "../../../assets/brand/geometry.json";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const launchArt = require("../../../assets/brand/native-launch-continuity.png");
const launchArtSize = Image.resolveAssetSource(launchArt);

// The matching Android Activity layer keeps these glows visible while JS starts.
export const SplashScreen: React.FC = () => {
  return (
    <View style={styles.wrap}>
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
      <PetalBackdrop variant="splash" />
      <View style={styles.content}>
        <Image source={launchArt} resizeMode="contain" style={styles.launchArt} accessible={false} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: geometry.nativeLaunch.background,
  },
  glowTopRight: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: geometry.nativeLaunch.glows.topRight.color,
    opacity: geometry.nativeLaunch.glows.topRight.opacity,
    top: geometry.nativeLaunch.glows.topRight.topDp,
    right: geometry.nativeLaunch.glows.topRight.rightDp,
    width: geometry.nativeLaunch.glows.topRight.sizeDp,
    height: geometry.nativeLaunch.glows.topRight.sizeDp,
  },
  glowBottomLeft: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: geometry.nativeLaunch.glows.bottomLeft.color,
    opacity: geometry.nativeLaunch.glows.bottomLeft.opacity,
    bottom: geometry.nativeLaunch.glows.bottomLeft.bottomDp,
    left: geometry.nativeLaunch.glows.bottomLeft.leftDp,
    width: geometry.nativeLaunch.glows.bottomLeft.sizeDp,
    height: geometry.nativeLaunch.glows.bottomLeft.sizeDp,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  launchArt: {
    width: geometry.nativeLaunch.imageWidthDp,
    aspectRatio: launchArtSize.width / launchArtSize.height,
  },
});
