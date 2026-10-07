import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

// Mirrors aroha_ui_deisgn_files/calls.jsx > CallBg — full-screen dark
// gradient with a blurred-feel photo backdrop. The photo URL is optional;
// we fall back to a flat purple wash when there's no photo to use.
export const CallShell: React.FC<{
  photoUri?: string | null;
  children: React.ReactNode;
}> = ({ photoUri, children }) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: palette.alwaysInk }]}>
      <StatusBar style="light" />
      {photoUri ? (
        <ImageBackground
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          blurRadius={30}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.alwaysInk }]} />
      )}
      <LinearGradient
        colors={[palette.inkAlpha50, palette.inkAlpha85]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: "hidden",
  },
});
