#!/usr/bin/env python3
"""Render native assets from the supplied textured petals and Yariva wordmark."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BRAND_DIRECTORY = PROJECT_ROOT / "assets" / "brand"
GEOMETRY = json.loads((BRAND_DIRECTORY / "geometry.json").read_text(encoding="utf-8"))
OUTPUT_SIZE = 1024


def parse_hex(value: str) -> tuple[int, int, int, int]:
    value = value.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected six-digit hex colour, got {value!r}")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4)) + (255,)


def render_mark(output_name: str, *, background: str | None = None, monochrome: bool = False, scale: float = 1.0) -> None:
    """Place the actual petal cutout in a square native asset without redrawing it."""
    source = Image.open(BRAND_DIRECTORY / "petal-artwork.png").convert("RGBA")
    if source.width != source.height:
        raise ValueError("The supplied petal cutout must remain square")
    target_size = round(OUTPUT_SIZE * scale)
    source = source.resize((target_size, target_size), Image.Resampling.LANCZOS)
    if monochrome:
        white = Image.new("RGBA", source.size, (255, 255, 255, 0))
        white.putalpha(source.getchannel("A"))
        source = white
    canvas = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE), parse_hex(background) if background else (0, 0, 0, 0))
    canvas.alpha_composite(source, ((OUTPUT_SIZE - target_size) // 2, (OUTPUT_SIZE - target_size) // 2))
    if background:
        canvas = canvas.convert("RGB")
    canvas.save(BRAND_DIRECTORY / output_name, format="PNG", optimize=True)


def render_wordmark(output_name: str, *, dark: bool = False) -> None:
    """Keep the supplied Yariva lettering pixel-for-pixel; only recolor the dot."""
    colours = GEOMETRY["colors"]
    source = Image.open(PROJECT_ROOT / "assets" / "yariva-wordmark-light-tight.png").convert("RGBA")
    if source.size != (999, 315):
        raise ValueError("The original Yariva wordmark crop changed unexpectedly")
    ink = parse_hex(colours["ivory"] if dark else colours["ink"])
    dot = parse_hex(colours["petalDarkDeep"] if dark else colours["petalDeep"])
    pixels = []
    for red, green, blue, alpha in source.get_flattened_data():
        if alpha <= 7:
            pixels.append((0, 0, 0, 0))
        elif red > 160 and red > green * 1.5 and red > blue * 1.3:
            pixels.append((*dot[:3], alpha))
        else:
            pixels.append((*ink[:3], alpha))
    source.putdata(pixels)
    source.save(BRAND_DIRECTORY / output_name, format="PNG", optimize=True)


def render_native_launch() -> None:
    """Match the centered React splash art while Android starts JavaScript."""
    source = Image.open(BRAND_DIRECTORY / "wordmark-light.png").convert("RGBA")
    if source.size != (999, 315):
        raise ValueError(f"Unexpected in-app wordmark size: {source.size}")

    launch = GEOMETRY["nativeLaunch"]
    # The native and React layers share the same image and text dimensions.
    scale = source.width / launch["imageWidthDp"]
    if abs(source.height / scale - launch["wordmarkHeightDp"]) > 0.2:
        raise ValueError("Native wordmark height no longer matches React splash")
    petal = Image.open(BRAND_DIRECTORY / "splash-mark-light.png").convert("RGBA")
    petal_size = round(launch["petalSizeDp"] * scale)
    petal = petal.resize((petal_size, petal_size), Image.Resampling.LANCZOS)
    wordmark_top = petal_size + round(5 * scale)
    line_height = round(launch["taglineLineHeightDp"] * scale)
    first_line_top = wordmark_top + source.height + round(launch["taglineGapDp"] * scale)
    canvas_height = wordmark_top + source.height + round(
        (launch["taglineGapDp"] + 2 * launch["taglineLineHeightDp"]) * scale
    )
    canvas = Image.new("RGBA", (source.width, canvas_height), (0, 0, 0, 0))
    canvas.alpha_composite(petal, ((source.width - petal_size) // 2, 0))
    canvas.alpha_composite(source, (0, wordmark_top))
    font = ImageFont.truetype(
        PROJECT_ROOT / "node_modules" / "@expo-google-fonts" / "inter" / "Inter_400Regular.ttf",
        round(launch["taglineFontSizeDp"] * scale),
    )
    drawing = ImageDraw.Draw(canvas)
    colour = parse_hex(launch["tagline"])
    for index, line in enumerate(("Real connection,", "made gently.")):
        drawing.text(
            (source.width / 2, first_line_top + line_height * (index + 0.5)),
            line,
            font=font,
            fill=colour,
            anchor="mm",
        )
    canvas.save(BRAND_DIRECTORY / "native-launch-continuity.png", format="PNG", optimize=True)
    (BRAND_DIRECTORY / "native-launch-transparent.png").unlink(missing_ok=True)


def main() -> None:
    launcher = GEOMETRY["launcherIcon"]
    for name in ("app-icon-ios.png", "app-icon-legacy.png"):
        render_mark(name, background=launcher["background"], scale=0.7)
    render_mark("adaptive-icon-foreground.png", scale=launcher["markScale"])
    render_mark("adaptive-icon-monochrome.png", monochrome=True, scale=launcher["markScale"])
    render_mark("splash-mark-light.png", scale=0.66)
    render_mark("splash-mark-dark.png", scale=0.66)
    render_wordmark("wordmark-light.png")
    render_wordmark("wordmark-dark.png", dark=True)
    render_native_launch()
    print("Rasterized 9 Yariva petal and native PNG assets.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # pragma: no cover - command-line guard
        print(f"Brand asset generation failed: {error}", file=sys.stderr)
        raise
