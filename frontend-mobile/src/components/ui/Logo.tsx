import React from "react";
import { View } from "react-native";
import { YarivaMark } from "./YarivaBrand";

export interface LogoProps {
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 64 }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <YarivaMark size={size} />
  </View>
);
