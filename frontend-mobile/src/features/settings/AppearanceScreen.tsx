import React from "react";
import { View } from "react-native";
import { Header } from "../../components/layout/Header";
import { Screen } from "../../components/layout/Screen";
import { NavigationListRow, NavigationListSection } from "../../components/ui/NavigationList";
import { useSafeBack } from "../../navigation/useSafeBack";
import { useTheme, type ThemeMode } from "../../theme/ThemeContext";
import { useResponsiveLayout } from "../../theme/responsive";
export const AppearanceScreen = () => {
  const back = useSafeBack("/(app)/settings"),
    { mode, setMode } = useTheme(),
    layout = useResponsiveLayout();
  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: "system", label: "Use device setting" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
  return (
    <Screen scroll>
      <View style={{ marginHorizontal: -layout.screenPadding }}>
        <Header title="Appearance" showBack onLeftPress={back} />
      </View>
      <NavigationListSection>
        {options.map((option, index) => (
          <NavigationListRow
            key={option.value}
            first={index === 0}
            label={option.label}
            icon={option.value === "dark" ? "moon" : option.value === "light" ? "eye" : "device"}
            selected={mode === option.value}
            onPress={() => setMode(option.value)}
          />
        ))}
      </NavigationListSection>
    </Screen>
  );
};
