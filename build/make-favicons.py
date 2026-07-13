#!/usr/bin/env python3
"""Generate the Incubator favicon set from the site's own typeface.

The mark is a capital "I" in Century Schoolbook (the wordmark face,
css/fonts/centuryschoolbook.ttf) in Incubator green (#009838, the
zine-sampled --green) on a white ground. The glyph outline is pulled
straight from the font so the icon matches the site exactly — no
approximation, no embedded webfont needed at render time.

Outputs (repo root):
  favicon.svg          round white disc + green I   (modern tabs)
  favicon.ico          16/32/48 multi-res            (legacy)
  apple-touch-icon.png 180x180 white square + I      (iOS home screen)
  icon-192.png         192x192 maskable              (PWA / Android)
  icon-512.png         512x512 maskable              (PWA / share)

Rasterisation uses ImageMagick (`magick`). Re-run after any font change.
"""
import subprocess
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "css/fonts/centuryschoolbook.ttf"
GREEN = "#009838"

font = TTFont(FONT)
glyphs = font.getGlyphSet()
glyph = glyphs[font.getBestCmap()[ord("I")]]

pen = SVGPathPen(glyphs)
glyph.draw(pen)
path_d = pen.getCommands()

bounds = BoundsPen(glyphs)
glyph.draw(bounds)
xmin, ymin, xmax, ymax = bounds.bounds
gcx, gcy = (xmin + xmax) / 2, (ymin + ymax) / 2
gh = ymax - ymin


def glyph_group(canvas: int, height_ratio: float) -> str:
    """Green I, scaled to height_ratio of the canvas and centred, y-flipped
    from font space (y-up) into SVG space (y-down)."""
    s = (canvas * height_ratio) / gh
    tx = canvas / 2 - s * gcx
    ty = canvas / 2 + s * gcy
    return (
        f'<g transform="translate({tx:.3f} {ty:.3f}) scale({s:.5f} {-s:.5f})">'
        f'<path d="{path_d}" fill="{GREEN}"/></g>'
    )


def disc_svg(canvas=512, height_ratio=0.56) -> str:
    r = canvas / 2
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas} {canvas}" '
        f'width="{canvas}" height="{canvas}">'
        f'<circle cx="{r}" cy="{r}" r="{r}" fill="#ffffff"/>'
        f'{glyph_group(canvas, height_ratio)}</svg>'
    )


def square_svg(canvas=512, height_ratio=0.50) -> str:
    # Full-bleed white ground: iOS masks the corners, Android maskable icons
    # crop to a safe zone, so the I sits at ~50% height inside the safe area.
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas} {canvas}" '
        f'width="{canvas}" height="{canvas}">'
        f'<rect width="{canvas}" height="{canvas}" fill="#ffffff"/>'
        f'{glyph_group(canvas, height_ratio)}</svg>'
    )


def magick(svg: str, out: Path, size: int):
    subprocess.run(
        ["magick", "-background", "none", "-density", "512",
         "svg:-", "-resize", f"{size}x{size}", str(out)],
        input=svg.encode(), check=True,
    )


def main():
    (ROOT / "favicon.svg").write_text(disc_svg(), encoding="utf-8")
    print("wrote favicon.svg")

    disc = disc_svg()
    square = square_svg()

    # Multi-resolution .ico from the disc.
    magick(disc, ROOT / "favicon-16.png", 16)
    magick(disc, ROOT / "favicon-32.png", 32)
    magick(disc, ROOT / "favicon-48.png", 48)
    subprocess.run(
        ["magick", str(ROOT / "favicon-16.png"), str(ROOT / "favicon-32.png"),
         str(ROOT / "favicon-48.png"), str(ROOT / "favicon.ico")],
        check=True,
    )
    for tmp in ("favicon-16.png", "favicon-32.png", "favicon-48.png"):
        (ROOT / tmp).unlink()
    print("wrote favicon.ico")

    magick(square, ROOT / "apple-touch-icon.png", 180)
    magick(square, ROOT / "icon-192.png", 192)
    magick(square, ROOT / "icon-512.png", 512)
    print("wrote apple-touch-icon.png, icon-192.png, icon-512.png")


if __name__ == "__main__":
    sys.exit(main())
