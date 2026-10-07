import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { darkPalette, lightPalette, type Palette } from "./colors";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  palette: Palette;
  setMode: (next: ThemeMode) => void;
}

// Yariva starts with the warm ivory theme for every existing fixture/session;
// an old Aroha system preference must not silently switch the new identity to
// dark mode on first launch.
const STORAGE_KEY = "yariva.themeMode";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const system = useColorScheme();
  // Yariva opens in its intended warm light theme. Dark mode stays an
  // explicit preference rather than changing the brand by device setting.
  const [mode, setModeState] = useState<ThemeMode>("light");

  // Hydrate persisted mode once on mount.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModeState(saved);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const resolved: ResolvedTheme =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      palette: resolved === "dark" ? darkPalette : lightPalette,
      setMode,
    }),
    [mode, resolved, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Creates a hook backed by the immutable palette in ThemeContext. Define the
 * hook once at module scope, then call it inside a component. It updates with
 * the active palette without mutating globals or remounting the navigation tree.
 */
export const createThemeStyleHook = <T extends StyleSheet.NamedStyles<T>>(
  factory: (palette: Palette) => T,
) => {
  return (): T => {
    const { palette } = useTheme();
    return useMemo(() => StyleSheet.create(factory(palette)), [palette]);
  };
};
