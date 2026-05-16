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


def figure_runs(im, y, threshold=WHITE_THRESHOLD):
    rgb = im.convert("RGB")
    w, _ = rgb.size
    px = rgb.load()
    runs, in_run, s = [], False, 0
    for x in range(w):
        r, g, b = px[x, y]
        non_white = (r < threshold or g < threshold or b < threshold)
        if non_white and not in_run:
            in_run, s = True, x
        elif not non_white and in_run:
            in_run = False; runs.append((s, x - 1))
    if in_run:
        runs.append((s, w - 1))
    return runs


def body_centerline(im, y):
    """Midpoint of the widest non-white run at row y — gives torso centerline
    without being skewed by asymmetric arms or background marks."""
    runs = figure_runs(im, y)
    if not runs:
        return None
    best = max(runs, key=lambda r: r[1] - r[0])
    return (best[0] + best[1]) / 2


def normalize_to_reference(src_im, ref_im):
    """Crop+resize src so its figure lands at the same vertical bounds AND
    its torso centerline matches the reference's torso centerline. Vertical
    alignment uses the figure bbox; horizontal alignment uses the torso
    centerline (more reliable than bbox when arms hang asymmetrically)."""
    ref_w, ref_h = ref_im.size
    rbx0, rby0, rbx1, rby1 = figure_bbox(ref_im)
    ref_bh = rby1 - rby0

    sbx0, sby0, sbx1, sby1 = figure_bbox(src_im)
    src_bh = sby1 - sby0

    # Scale so the figure heights match; height is the most reliable axis.
    scale = ref_bh / src_bh
    new_src_w = int(round(src_im.width * scale))
    new_src_h = int(round(src_im.height * scale))
    scaled = src_im.resize((new_src_w, new_src_h), Image.LANCZOS)

    # Vertical: align top of figure bbox with reference's top.
    scaled_by0 = sby0 * scale
    offset_y = int(round(rby0 - scaled_by0))

    # Horizontal: align torso centerline at a row in the abdomen, where
    # the body is widest and least affected by limbs/hair/hairline.
    # Sample at ~50% of the figure's height (mid-torso).
    sample_ref_y = (rby0 + rby1) // 2
    sample_src_y = int(round((sample_ref_y - offset_y)))
    sample_src_y = max(0, min(new_src_h - 1, sample_src_y))
    ref_cx = body_centerline(ref_im, sample_ref_y)
    src_cx = body_centerline(scaled, sample_src_y)
    if ref_cx is None or src_cx is None:
        raise RuntimeError("centerline detection failed")
    offset_x = int(round(ref_cx - src_cx))
    print(f"    centering at ref_y={sample_ref_y}: ref_cx={ref_cx:.1f}, src_cx={src_cx:.1f}, dx={offset_x}")

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
