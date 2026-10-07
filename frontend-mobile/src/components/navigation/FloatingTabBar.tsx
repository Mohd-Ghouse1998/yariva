import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { PetalGradient } from "../ui/PetalGradient";
import { useTheme } from "../../theme/ThemeContext";
import { controlSize } from "../../theme/spacing";
import {
  BOTTOM_NAV_VISUAL_HEIGHT,
  getBottomNavigationMetrics,
  useRegisterBottomNavigationInset,
} from "./bottomNavigation";

const TAB_META: Record<string, { label: string; compactLabel?: string; icon: IconName }> = {
  discover: { label: "Discover", icon: "leaf" },
  connections: { label: "Connections", compactLabel: "Connect", icon: "people" },
  "date-plans": { label: "Meetups", icon: "calendar" },
  chats: { label: "Chats", icon: "chat" },
  profile: { label: "Profile", icon: "user" },
};

/**
 * One shared, floating navigation dock for every root area.  It follows the
 * proven mobile_app_v3 implementation: solid glyph for the active destination,
 * outline glyph otherwise, fixed safe-area clearance, and a compact single-word
 * label.  Keeping this here prevents individual tabs from drifting visually.
 */
export const FloatingTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const current = state.routes[state.index];
  const visibility = descriptors[current.key]?.options.tabBarStyle as
    { display?: string } | undefined;
  const visible = visibility?.display !== "none";
  const metrics = getBottomNavigationMetrics(insets.bottom);
  useRegisterBottomNavigationInset(metrics.reservedInset, visible);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          bottom: metrics.edgeOffset,
          backgroundColor: palette.surface,
          borderColor: palette.border,
          shadowColor: palette.alwaysBlack,
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name] ?? { label: route.name, icon: "compass" as IconName };
        const color = focused ? palette.brandStrong : palette.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <View style={styles.iconFrame}>
              {focused ? <PetalGradient tone="soft" style={styles.activeIconBlend} /> : null}
              <Icon name={meta.icon} filled={focused} size={21} color={color} />
            </View>
            <Text variant="micro" weight="600" style={[styles.label, { color }]} numberOfLines={1}>
              {meta.compactLabel ?? meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 14,
    right: 14,
    minHeight: BOTTOM_NAV_VISUAL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    overflow: "hidden",
  },
  item: {
    flex: 1,
    minHeight: controlSize.minimumTouchTarget,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconFrame: {
    width: 31,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconBlend: {
    ...StyleSheet.absoluteFill,
    borderRadius: 9,
  },
  label: { fontSize: 10.5, lineHeight: 13 },
  pressed: { opacity: 0.62 },
});
