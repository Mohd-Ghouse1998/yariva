import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import { createThemeStyleHook, useTheme } from "../../theme/ThemeContext";
import { Icon } from "../ui/Icon";

export const NotificationButton: React.FC<{ unread?: boolean }> = ({ unread = false }) => {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? "Notifications, unread activity" : "Notifications"}
      onPress={() => router.push("/(app)/notifications")}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Icon name="bell" size={21} color={palette.textPrimary} />
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
};

const useStyles = createThemeStyleHook((palette) => ({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  dot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.brand,
    borderWidth: 1.5,
    borderColor: palette.background,
  },
  pressed: {
    opacity: 0.72,
  },
}));
