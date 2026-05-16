#!/usr/bin/env python3
"""Split 参考画像/女.png (front+back side-by-side) into two webp files matching
the male anatomy assets' framing so the existing SVG overlay coordinates line up.

Approach:
  1. Measure the figure bounding-box (non-white pixels) inside the male
     anatomy-front.webp / anatomy-back.webp. This gives us the canonical
     "figure occupies these proportional bounds" target for each view.
  2. Split 女.png at its horizontal midpoint into left (front) and right (back)
     panels, measure each figure's bbox, then crop+resize so the female figure
     lands at the same proportional position/size as the male reference."""
from pathlib import Path
from PIL import Image
import sys

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SRC = ROOT / "参考画像" / "女.png"
MALE_FRONT = ASSETS / "anatomy-front.webp"
MALE_BACK = ASSETS / "anatomy-back.webp"
OUT_FRONT = ASSETS / "anatomy-female-front.webp"
OUT_BACK = ASSETS / "anatomy-female-back.webp"

# Pixels with all channels >= this threshold are treated as background.
WHITE_THRESHOLD = 240


def figure_bbox(im):
    """Return (left, top, right, bottom) of non-white content."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r < WHITE_THRESHOLD or g < WHITE_THRESHOLD or b < WHITE_THRESHOLD:
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
    if min_x >= max_x or min_y >= max_y:
        raise RuntimeError("no figure detected")
    return (min_x, min_y, max_x + 1, max_y + 1)


def normalize_to_reference(src_im, ref_im):
    """Crop+resize src so its figure bbox lands at the same proportional
    bounds (and same overall canvas size) as ref's figure bbox."""
    ref_w, ref_h = ref_im.size
    rbx0, rby0, rbx1, rby1 = figure_bbox(ref_im)
    ref_bw, ref_bh = rbx1 - rbx0, rby1 - rby0

    sbx0, sby0, sbx1, sby1 = figure_bbox(src_im)
    src_bw, src_bh = sbx1 - sbx0, sby1 - sby0

    # Pick scale so the source figure matches the reference figure size.
    # Use the larger required scale so the figure fully fits; height tends
    # to be the dominant axis for these full-body silhouettes.
    scale = min(ref_bw / src_bw, ref_bh / src_bh)
    new_bw = src_bw * scale
    new_bh = src_bh * scale

    # New canvas size before placing the figure on it.
    new_src_w = int(round(src_im.width * scale))
    new_src_h = int(round(src_im.height * scale))
    scaled = src_im.resize((new_src_w, new_src_h), Image.LANCZOS)

    # Where the figure bbox lands in the scaled source image.
    scaled_bx0 = sbx0 * scale
    scaled_by0 = sby0 * scale

    # Target: figure bbox should land at (rbx0, rby0) on a (ref_w, ref_h) canvas.
    # So we want to paste scaled image at offset = (rbx0 - scaled_bx0, rby0 - scaled_by0).
    offset_x = int(round(rbx0 - scaled_bx0))
    offset_y = int(round(rby0 - scaled_by0))

    canvas = Image.new("RGB", (ref_w, ref_h), (255, 255, 255))
    canvas.paste(scaled.convert("RGB"), (offset_x, offset_y))
    return canvas


def main():
    if not SRC.exists():
        sys.exit(f"missing source: {SRC}")
    src = Image.open(SRC).convert("RGB")
    w, h = src.size
    print(f"source: {w}x{h}")

    # Split at horizontal midpoint.
    mid = w // 2
    left = src.crop((0, 0, mid, h))   # front
    right = src.crop((mid, 0, w, h))  # back

    male_front = Image.open(MALE_FRONT).convert("RGB")
    male_back = Image.open(MALE_BACK).convert("RGB")
    print(f"male front bbox: {figure_bbox(male_front)}  size={male_front.size}")
    print(f"male back  bbox: {figure_bbox(male_back)}   size={male_back.size}")
    print(f"female L bbox:   {figure_bbox(left)}  size={left.size}")
    print(f"female R bbox:   {figure_bbox(right)} size={right.size}")

    out_front = normalize_to_reference(left, male_front)
    out_back = normalize_to_reference(right, male_back)

    out_front.save(OUT_FRONT, "WEBP", quality=88, method=6)
    out_back.save(OUT_BACK, "WEBP", quality=88, method=6)
    print(f"wrote {OUT_FRONT.relative_to(ROOT)} ({out_front.size})")
    print(f"wrote {OUT_BACK.relative_to(ROOT)} ({out_back.size})")


if __name__ == "__main__":
    main()
