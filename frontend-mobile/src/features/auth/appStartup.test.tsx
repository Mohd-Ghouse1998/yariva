import React from "react";
import { act, create } from "react-test-renderer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({
  fontsLoaded: false,
  fontError: null as Error | null,
  hide: vi.fn(),
  preventAutoHideAsync: vi.fn().mockResolvedValue(true),
}));

const Provider = ({ children }: React.PropsWithChildren) => <>{children}</>;

vi.mock("@expo-google-fonts/inter", () => ({
  Inter_400Regular: 1,
  Inter_500Medium: 2,
  Inter_600SemiBold: 3,
}));
vi.mock("@expo-google-fonts/space-grotesk", () => ({
  SpaceGrotesk_500Medium: 4,
  SpaceGrotesk_600SemiBold: 5,
}));
vi.mock("expo-font", () => ({ useFonts: () => [startup.fontsLoaded, startup.fontError] }));
vi.mock("expo-splash-screen", () => ({
  hide: startup.hide,
  preventAutoHideAsync: startup.preventAutoHideAsync,
}));
vi.mock("react-native", () => ({ LogBox: { ignoreLogs: vi.fn() } }));
vi.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("AppRoot", props, children),
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: Provider }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-router", () => {
  const Stack = ({ children }: React.PropsWithChildren) => <>{children}</>;
  Stack.Screen = function Screen() {
    return null;
  };
  return { Stack };
});
vi.mock("../../auth/AuthContext", () => ({ AuthProvider: Provider }));
vi.mock("../../components/ui/Toast", () => ({ ToastProvider: Provider }));
vi.mock("../../components/navigation/bottomNavigation", () => ({
  BottomNavigationProvider: Provider,
}));
vi.mock("../calls/CallManager", () => ({ CallManagerProvider: Provider }));
vi.mock("../../realtime/RealtimeProvider", () => ({ RealtimeProvider: Provider }));
vi.mock("../../localization/LocalizationContext", () => ({ LocalizationProvider: Provider }));
vi.mock("../../theme/ThemeContext", () => ({
  ThemeProvider: Provider,
  useTheme: () => ({ palette: { background: "#FBF8F3" }, resolved: "light" }),
}));

// React Native supplies this global before the router evaluates the app layout.
vi.stubGlobal("__DEV__", true);
const { default: RootLayout } = await import("../../../app/_layout");
afterAll(() => vi.unstubAllGlobals());

describe("Yariva startup splash handoff", () => {
  beforeEach(() => {
    startup.fontsLoaded = false;
    startup.fontError = null;
    startup.hide.mockClear();
  });

  it("retains the native splash through font loading and releases it only after layout", async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<RootLayout />);
    });
    expect(startup.preventAutoHideAsync).toHaveBeenCalledOnce();
    expect(renderer!.toJSON()).toBeNull();
    expect(startup.hide).not.toHaveBeenCalled();

    startup.fontsLoaded = true;
    await act(async () => {
      renderer!.update(<RootLayout />);
    });
    expect(startup.hide).not.toHaveBeenCalled();
    await act(async () => {
      renderer!.root.findByType(GestureHandlerRootView).props.onLayout();
    });
    expect(startup.hide).toHaveBeenCalledOnce();
    await act(async () => {
      renderer!.unmount();
    });
  });

  it("allows fallback fonts after a loading error instead of trapping the user on the splash", async () => {
    startup.fontError = new Error("Font download unavailable");
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<RootLayout />);
    });
    await act(async () => {
      renderer!.root.findByType(GestureHandlerRootView).props.onLayout();
    });
    expect(startup.hide).toHaveBeenCalledOnce();
    await act(async () => {
      renderer!.unmount();
    });
  });
});
