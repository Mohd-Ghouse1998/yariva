import React from "react";
import { TextStyle } from "react-native";
import { Text } from "./Text";

// 11px / 700 / +1 letterspacing / muted — used as the small caps label
// above grouped lists in settings, profile, etc.
export const SectionTitle: React.FC<{
  children: React.ReactNode;
  style?: TextStyle;
}> = ({ children, style }) => (
  <Text
    variant="captionStrong"
    color="textSubdued"
    style={[
      { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 22, marginBottom: 10 },
      style,
    ]}
  >
    {children}
  </Text>
);
