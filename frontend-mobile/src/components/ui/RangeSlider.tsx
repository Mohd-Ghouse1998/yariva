import React, { useCallback, useMemo, useRef, useState } from "react";
import { PanResponder, View, type ViewStyle } from "react-native";
import type { Palette } from "../../theme/colors";
import { createThemeStyleHook } from "../../theme/ThemeContext";

export interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  step?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
  hideLowHandle?: boolean;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  value,
  onChange,
  step = 1,
  style,
  accessibilityLabel = "Range",
  hideLowHandle = false,
}) => {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const ratio = useCallback(
    (number: number) => (max === min ? 0 : (number - min) / (max - min)),
    [max, min],
  );

  const fromX = useCallback(
    (x: number) => {
      if (width <= 0) return min;
      const position = Math.max(0, Math.min(1, x / width));
      const raw = min + position * (max - min);
      return min + Math.round((raw - min) / step) * step;
    },
    [max, min, step, width],
  );

  const updateHandle = useCallback(
    (which: 0 | 1, next: number) => {
      if (which === 0) {
        const low = Math.max(min, Math.min(next, valueRef.current[1]));
        onChange([low, valueRef.current[1]]);
      } else {
        const high = Math.min(max, Math.max(next, valueRef.current[0]));
        onChange([valueRef.current[0], high]);
      }
    },
    [max, min, onChange],
  );

  const makeResponder = useMemo(
    () => (which: 0 | 1) => {
      let gestureStart = valueRef.current[which];
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gestureStart = valueRef.current[which];
        },
        onPanResponderMove: (_event, gesture) => {
          updateHandle(which, fromX(ratio(gestureStart) * width + gesture.dx));
        },
      });
    },
    [fromX, ratio, updateHandle, width],
  );

  const lowResponder = useMemo(() => makeResponder(0), [makeResponder]);
  const highResponder = useMemo(() => makeResponder(1), [makeResponder]);

  const accessibilityAction = (which: 0 | 1, actionName: string) => {
    const direction = actionName === "increment" ? 1 : actionName === "decrement" ? -1 : 0;
    if (direction !== 0) updateHandle(which, valueRef.current[which] + direction * step);
  };

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.track} />
      <View
        style={[
          styles.fill,
          {
            left: `${ratio(value[0]) * 100}%`,
            right: `${(1 - ratio(value[1])) * 100}%`,
          },
        ]}
      />

      {!hideLowHandle ? (
        <View
          {...lowResponder.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${accessibilityLabel}, minimum`}
          accessibilityActions={[{ name: "decrement" }, { name: "increment" }]}
          accessibilityValue={{ min, max: value[1], now: value[0] }}
          onAccessibilityAction={(event) => accessibilityAction(0, event.nativeEvent.actionName)}
          style={[styles.handleTarget, styles.lowHandle, { left: `${ratio(value[0]) * 100}%` }]}
        >
          <View style={styles.handle} />
        </View>
      ) : null}

      <View
        {...highResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={hideLowHandle ? accessibilityLabel : `${accessibilityLabel}, maximum`}
        accessibilityActions={[{ name: "decrement" }, { name: "increment" }]}
        accessibilityValue={{ min: value[0], max, now: value[1] }}
        onAccessibilityAction={(event) => accessibilityAction(1, event.nativeEvent.actionName)}
        style={[styles.handleTarget, styles.highHandle, { left: `${ratio(value[1]) * 100}%` }]}
      >
        <View style={styles.handle} />
      </View>
    </View>
  );
};

export const SingleSlider: React.FC<{
  min: number;
  max: number;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}> = ({ min, max, value, onChange, step = 1, style, accessibilityLabel }) => (
  <RangeSlider
    min={min}
    max={max}
    value={[min, value]}
    onChange={(next) => onChange(next[1])}
    step={step}
    style={style}
    accessibilityLabel={accessibilityLabel}
    hideLowHandle
  />
);

const useStyles = createThemeStyleHook((palette: Palette) => ({
  wrap: {
    height: 36,
    position: "relative",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
  },
  fill: {
    position: "absolute",
    top: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.brand,
  },
  handleTarget: {
    position: "absolute",
    top: -4,
    width: 44,
    height: 44,
    marginLeft: -22,
    alignItems: "center",
    justifyContent: "center",
  },
  lowHandle: {
    zIndex: 2,
  },
  highHandle: {
    zIndex: 3,
  },
  handle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.brand,
    shadowColor: palette.alwaysInk,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
}));
