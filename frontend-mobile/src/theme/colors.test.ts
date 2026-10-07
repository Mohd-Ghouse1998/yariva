import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette } from "./colors";

const luminance = (hex: string): number => {
  const channels = hex.match(/[0-9a-f]{2}/gi);
  if (!channels || channels.length !== 3) throw new Error(`Expected RGB hex: ${hex}`);
  const [red, green, blue] = channels.map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
};

const contrast = (foreground: string, background: string): number => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("Warm Human Modern theme", () => {
  it("keeps neutral surfaces and distinct semantic accents", () => {
    expect(lightPalette.background).toBe("#FFFCF8");
    expect(lightPalette.surface).toBe("#FFFFFF");
    expect(lightPalette.surfaceTint).toBe("#F5EFE8");
    expect(lightPalette.brandPrimary).toBe("#E76F51");
    expect(lightPalette.brandSecondary).toBe("#C9634F");
    expect(lightPalette.brandPlum).toBe("#694353");
    expect(lightPalette.brandSage).toBe("#8A987D");
    expect(lightPalette.interestStart).toBe("#C65A3C");
    expect(lightPalette.interestEnd).toBe("#B55065");
    expect(lightPalette.followStart).not.toBe(lightPalette.interestStart);
    expect(lightPalette.textPrimary).toBe("#171719");
  });

  it("keeps text-bearing actions and body text at AA contrast in both modes", () => {
    for (const palette of [lightPalette, darkPalette]) {
      expect(contrast(palette.textOnBrand, palette.brandStrong)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.ctaText, palette.ctaStart)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.ctaText, palette.ctaEnd)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.textPrimary, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.textSecondary, palette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.textMuted, palette.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the petal mark distinct from the action and status colours", () => {
    expect(lightPalette.petalMid).not.toBe(lightPalette.brand);
    expect(lightPalette.like).not.toBe(lightPalette.brand);
    expect(lightPalette.success).not.toBe(lightPalette.brand);
  });
});
