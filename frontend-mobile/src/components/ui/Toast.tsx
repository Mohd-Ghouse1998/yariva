import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomNavigationInset } from "../navigation/bottomNavigation";
import { radius, spacing } from "../../theme/spacing";
import { shadows } from "../../theme/shadows";
import { useTheme } from "../../theme/ThemeContext";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

type ToastTone = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  action?: {
    label: string;
    onPress: () => void | Promise<void>;
  };
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone, action?: ToastItem["action"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const insets = useSafeAreaInsets();
  const bottomNavigationInset = useBottomNavigationInset();

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const show = useCallback(
    (message: string, tone: ToastTone = "info", action?: ToastItem["action"]) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setItems((prev) => {
        // Dedupe: if the same message is already on screen, do nothing.
        if (prev.some((t) => t.message === message)) return prev;
        // Cap at 3 visible toasts to avoid stacking.
        const next = [...prev, { id, message, tone, action }];
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });
      const timer = setTimeout(
        () => {
          setItems((prev) => prev.filter((t) => t.id !== id));
          timers.current.delete(timer);
        },
        action ? 8000 : 3500,
      );
      timers.current.add(timer);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            bottom: Math.max(bottomNavigationInset + spacing.sm, insets.bottom + spacing.xxl),
          },
        ]}
      >
        {items.map((t) => (
          <ToastBubble key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const ToastBubble: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({
  item,
  onDismiss,
}) => {
  const { palette } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [opacity]);

  const tones: Record<ToastTone, { icon: IconName; accent: string }> = {
    info: { icon: "spark", accent: palette.info },
    success: { icon: "check", accent: palette.success },
    warning: { icon: "warning", accent: palette.warning },
    error: { icon: "warning", accent: palette.error },
  };
  const tone = tones[item.tone];

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        shadows.high,
        {
          opacity,
          backgroundColor: palette.inkAlpha85,
          borderColor: palette.whiteAlpha14,
        },
      ]}
    >
      <View style={[styles.iconWrap, { borderColor: tone.accent }]}>
        <Icon name={tone.icon} size={16} color={tone.accent} strokeWidth={2} />
      </View>
      <Text color="alwaysWhite" variant="bodyStrong" style={styles.message}>
        {item.message}
      </Text>
      {item.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.action.label}
          onPress={async () => {
            try {
              await item.action?.onPress();
            } finally {
              onDismiss(item.id);
            }
          }}
          style={({ pressed }) => [
            styles.action,
            { borderLeftColor: palette.whiteAlpha18 },
            pressed ? styles.actionPressed : null,
          ]}
        >
          <Text color="alwaysWhite" variant="captionStrong">
            {item.action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  message: {
    flex: 1,
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -spacing.sm,
    paddingLeft: spacing.md,
    borderLeftWidth: 1,
  },
  actionPressed: {
    opacity: 0.7,
  },
});
