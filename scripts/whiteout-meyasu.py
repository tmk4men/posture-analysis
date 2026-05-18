#!/usr/bin/env python3
"""Detect the 「目安（週○回実施）」green-text header in each exercise card
image and fill the bottom-right block (from the separator down) with white.

The per-frequency prescription is rendered dynamically in the report UI;
the image asset is purely the illustration + 運動のポイント from now on.

Run from repo root:
    python3 scripts/whiteout-meyasu.py
Originals are copied to assets/exercises/originals/ before any image is
modified. Re-running is safe (originals copy is no-op if it already exists).
"""

import os
import shutil
import sys

import numpy as np
from PIL import Image

EXERCISE_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "exercises")
EXERCISE_DIR = os.path.normpath(EXERCISE_DIR)
ORIGINAL_DIR = os.path.join(EXERCISE_DIR, "originals")

# Fill region:
#   x = 53% of width → right edge
#   y = detected 目安 header y - TOP_MARGIN → bottom edge
RIGHT_X_RATIO = 0.53
TOP_MARGIN_PX = 30  # back off above 目安 header to also cover the separator line


def find_meyasu_top(arr: np.ndarray, w: int, h: int) -> int | None:
    """Topmost row of the 目安 green-text header in the right column."""
    right = arr[:, int(w * 0.55):, :]
    r, g, b = right[:, :, 0], right[:, :, 1], right[:, :, 2]
    green_mask = (r < 60) & (g >= 40) & (g <= 100) & (b < 70) & (g > r) & (g > b)
    row_green = green_mask.sum(axis=1)
    threshold = right.shape[1] * 0.05
    for y in range(int(h * 0.50), h):
        if row_green[y] > threshold:
            window = row_green[y:y + 30]
            if (window > threshold).sum() >= 15:
                return y
    return None


def process(path: str) -> tuple[bool, str]:
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]
    meyasu_y = find_meyasu_top(arr, w, h)
    if meyasu_y is None:
        return False, f"could not locate 目安 header"
    fill_top = max(0, meyasu_y - TOP_MARGIN_PX)
    fill_left = int(w * RIGHT_X_RATIO)
    arr[fill_top:, fill_left:, :] = 255
    Image.fromarray(arr).save(path, "WEBP", quality=92)
    return True, f"filled y={fill_top}..{h}, x={fill_left}..{w}"


def main() -> int:
    os.makedirs(ORIGINAL_DIR, exist_ok=True)
    files = sorted(
        f for f in os.listdir(EXERCISE_DIR)
        if f.endswith(".webp") and os.path.isfile(os.path.join(EXERCISE_DIR, f))
    )
    if not files:
        print("no .webp files found", file=sys.stderr)
        return 1
    ok = 0
    fail = []
    for f in files:
        src = os.path.join(EXERCISE_DIR, f)
        bak = os.path.join(ORIGINAL_DIR, f)
        if not os.path.exists(bak):
            shutil.copy2(src, bak)
        success, msg = process(src)
        if success:
            ok += 1
            print(f"  ✓ {f}: {msg}")
        else:
            fail.append((f, msg))
            print(f"  ✗ {f}: {msg}", file=sys.stderr)
    print(f"\nProcessed {ok}/{len(files)} images. Originals saved to {ORIGINAL_DIR}")
    if fail:
        print(f"Failures: {len(fail)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
