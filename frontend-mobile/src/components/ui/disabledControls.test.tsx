import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: ({
    children,
    style,
    ...props
  }: React.PropsWithChildren<{
    style?: unknown | ((state: { pressed: boolean }) => unknown);
    [key: string]: unknown;
  }>) =>
    React.createElement(
      "Pressable",
      {
        ...props,
        style: typeof style === "function" ? style({ pressed: false }) : style,
      },
      children,
    ),
  StyleSheet: { create: <Styles,>(styles: Styles) => styles },
  View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("View", props, children),
}));

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("LinearGradient", props, children),
}));

vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({
    palette: {
      brand: "#C86E91",
      brandBorder: "#f8aba8",
      brandSubdued: "#FFF2F4",
      brandTint: "#FDE6EA",
      blendSoftStart: "#fff0e9",
      blendSoftEnd: "#ffe4ec",
      border: "#ddd",
      borderStrong: "#bbb",
      errorSubdued: "#fee",
      successSubdued: "#efe",
      surface: "#fff",
      warningSubdued: "#ffe",
    },
  }),
}));

vi.mock("./Text", () => ({
  Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("Text", props, children),
}));

vi.mock("./Switch", () => ({
  Switch: (props: Record<string, unknown>) => React.createElement("Switch", props),
}));

import { Chip } from "./Chip";
import { ToggleRow } from "./ToggleRow";

describe("disabled shared controls", () => {
  it("exposes and enforces the disabled state on an interactive chip", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Chip label="Dating" onPress={vi.fn()} disabled />);
    });

    const chip = renderer.root.findByProps({ accessibilityLabel: "Dating" });
    expect(chip.props.disabled).toBe(true);
    expect(chip.props.accessibilityState).toEqual({ selected: false, disabled: true });
  });

  it("uses the shared soft petal blend for a selected chip", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Chip label="Dating" selected onPress={vi.fn()} />);
    });

    expect(renderer.root.findByProps({ accessibilityLabel: "Dating" }).props.accessibilityState)
      .toEqual({ selected: true, disabled: false });
    expect(renderer.root.findAll((node) => node.props.colors?.[0] === "#fff0e9")[0]?.props.colors)
      .toEqual(["#fff0e9", "#ffe4ec"]);
  });

  it("disables both the semantic toggle row and its visual switch", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ToggleRow label="Show distance" value onValueChange={vi.fn()} disabled />,
      );
    });

    const row = renderer.root.findByProps({ accessibilityLabel: "Show distance" });
    expect(row.props.disabled).toBe(true);
    expect(row.props.accessibilityState).toEqual({ checked: true, disabled: true });

    const visualSwitch = renderer.root.findByProps({ accessible: false });
    expect(visualSwitch.props.disabled).toBe(true);
  });
});
