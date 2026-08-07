#!/usr/bin/env python3
"""Render the app icons from an emoji. Requires Pillow and macOS's Apple Color Emoji font.

    python3 -m venv .venv && .venv/bin/pip install Pillow
    .venv/bin/python tools/make-icons.py

Apple Color Emoji is an sbix font: it only renders at fixed strike sizes (the
largest is 160px), so glyphs are drawn at 160 and scaled up from there.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

EMOJI = "\N{FLEXED BICEPS}"
FONT = "/System/Library/Fonts/Apple Color Emoji.ttc"
STRIKE = 160  # largest bitmap strike in the font
OUT = Path(__file__).resolve().parent.parent / "icons"

BLUSH = (255, 241, 245, 255)  # page background
PETAL = (255, 208, 224, 255)  # maskable backdrop, tinted so the safe zone reads


def glyph(size: int) -> Image.Image:
    """The emoji alone, on transparency, at `size` px."""
    font = ImageFont.truetype(FONT, STRIKE)
    layer = Image.new("RGBA", (STRIKE * 2, STRIKE * 2), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((STRIKE, STRIKE), EMOJI, font=font, anchor="mm", embedded_color=True)
    return layer.crop(layer.getbbox()).resize((size, size), Image.LANCZOS)


def icon(size: int, bg, scale: float) -> Image.Image:
    """Emoji centred on a solid background, occupying `scale` of the canvas."""
    canvas = Image.new("RGBA", (size, size), bg)
    art = glyph(round(size * scale))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def main() -> None:
    OUT.mkdir(exist_ok=True)
    # `any` icons: emoji fills most of the tile.
    icon(192, BLUSH, 0.72).save(OUT / "icon-192.png")
    icon(512, BLUSH, 0.72).save(OUT / "icon-512.png")
    # `maskable`: Android crops to a circle/squircle, so keep art inside the
    # centre 80% safe zone and let the background bleed to the edges.
    icon(512, PETAL, 0.52).save(OUT / "icon-maskable-512.png")
    # iOS ignores transparency and never rounds for us — ship an opaque square.
    icon(180, BLUSH, 0.70).save(OUT / "apple-touch-icon.png")
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:26} {f.stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
