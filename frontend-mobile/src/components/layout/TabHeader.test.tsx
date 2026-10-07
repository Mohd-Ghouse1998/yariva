import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: <Styles,>(styles: Styles) => styles },
  useWindowDimensions: () => ({ width: 360, height: 780, fontScale: 1, scale: 3 }),
  View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("View", props, children),
}));

vi.mock("../../theme/ThemeContext", () => ({
  useTheme: () => ({ palette: { background: "#fff" } }),
}));

vi.mock("../ui/Text", () => ({
  Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("Text", props, children),
}));

import { TabHeader } from "./TabHeader";

describe("TabHeader layout", () => {
  it("keeps left, title and right content in one horizontal row", async () => {
    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(
        <TabHeader
          title="Discover"
          left={React.createElement("LeftAction")}
          right={React.createElement("RightAction")}
        />,
      );
    });

    const row = renderer?.root.findByProps({ testID: "tab-header-row" });

    expect(row).toBeDefined();
    expect(row?.props.style).toMatchObject({
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
    });
  });

  it("can replace the destination title with a brand treatment", async () => {
    const BrandMark = () => React.createElement("BrandMark");
    let renderer: ReturnType<typeof create> | undefined;
    await act(async () => {
      renderer = create(<TabHeader title="Discover" center={<BrandMark />} />);
    });

    expect(renderer?.root.findAllByType(BrandMark)).toHaveLength(1);
    expect(renderer?.root.findAllByProps({ accessibilityRole: "header" })).toHaveLength(0);
  });
});
