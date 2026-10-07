import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { FloatingTabBar } from "../../../src/components/navigation/FloatingTabBar";

const TABS = ["discover", "connections", "date-plans", "chats", "profile"] as const;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: Platform.OS === "android",
      }}
    >
      {TABS.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: name,
          }}
        />
      ))}
    </Tabs>
  );
}
