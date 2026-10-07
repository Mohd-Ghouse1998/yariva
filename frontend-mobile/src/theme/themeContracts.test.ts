import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: <Styles>(styles: Styles) => styles },
}));

import { darkPalette, lightPalette } from "./colors";
import { radius } from "./spacing";
import { typography } from "./typography";

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (foreground: string, background: string): number => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe("shared theme contracts", () => {
  it("keeps actions softly rounded without becoming capsule buttons", () => {
    expect(radius.button).toBe(14);
    expect(radius.button).toBeLessThan(radius.pill);
  });

  it("keeps normal text on the primary action above AA contrast", () => {
    expect(contrast(lightPalette.textOnBrand, lightPalette.brandStrong)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkPalette.textOnBrand, darkPalette.brandStrong)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps selected navigation and brand labels readable in both modes", () => {
    expect(contrast(lightPalette.brandStrong, lightPalette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightPalette.textBrand, lightPalette.brandTint)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightPalette.textBrand, lightPalette.secondarySubdued)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(lightPalette.premium, lightPalette.premiumSubdued)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkPalette.brandStrong, darkPalette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkPalette.textBrand, darkPalette.brandTint)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps clay actions separate from trust and like semantics", () => {
    expect(lightPalette.brand).not.toBe(lightPalette.success);
    expect(lightPalette.brand).not.toBe(lightPalette.like);
    expect(darkPalette.brand).not.toBe(darkPalette.success);
    expect(darkPalette.brand).not.toBe(darkPalette.like);
  });

  it("keeps both runtime palettes immutable", () => {
    expect(Object.isFrozen(lightPalette)).toBe(true);
    expect(Object.isFrozen(darkPalette)).toBe(true);
  });

  it("uses the exact bundled Inter faces for weighted typography", () => {
    expect(typography.body.fontFamily).toBe("Inter_400Regular");
    expect(typography.bodyStrong.fontFamily).toBe("Inter_600SemiBold");
    expect(typography.heading.fontFamily).toBe("SpaceGrotesk_600SemiBold");
    expect(typography.authTitle.fontFamily).toBe("SpaceGrotesk_500Medium");
    expect(typography.fieldLabel.fontFamily).toBe("Inter_500Medium");
    expect(typography.button.fontFamily).toBe("Inter_500Medium");
    for (const token of Object.values(typography)) {
      expect(token).not.toHaveProperty("fontWeight");
    }
  });
});
