#!/usr/bin/env python3
"""Render the current FRONT_MUSCLES / BACK_MUSCLES overlay paths from
anatomy.js on top of the base anatomy images, producing PNG previews
that Claude can read back to judge alignment without bouncing through
the user."""
import base64
import re
import sys
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ANATOMY_JS = ROOT / "src" / "ui" / "anatomy.js"
IMAGES = {
    "male":   (ROOT / "assets" / "anatomy-front.webp",        ROOT / "assets" / "anatomy-back.webp"),
    "female": (ROOT / "assets" / "anatomy-female-front.webp", ROOT / "assets" / "anatomy-female-back.webp"),
}
OUT_DIR = ROOT / ".debug-anatomy"

DEBUG_COLORS = {
    # Front
    "deep_neck_flexors":    "#e74c3c",
    "anterior_deltoid":     "#f39c12",
    "pectorals":            "#3498db",
    "biceps":               "#27ae60",
    "obliques":             "#8e44ad",
    "abdominals":           "#e67e22",
    "iliopsoas":            "#d35400",
    "quadriceps":           "#16a085",
    "adductors":            "#c0392b",
    # Back
    "upper_traps":          "#9b59b6",
    "posterior_deltoid":    "#f1c40f",
    "scapular_stabilizers": "#1abc9c",
    "lats":                 "#2980b9",
    "triceps":              "#7f8c8d",
    "erector_spinae":       "#34495e",
    "glutes":               "#e67e22",
    "gluteus_medius":       "#d35400",
    "hamstrings":           "#2ecc71",
    "calves":               "#c0392b",
}


def extract_template(js: str, var_name: str) -> str:
    pat = re.compile(rf"const {var_name} = `\s*(.*?)\s*`;", re.DOTALL)
    m = pat.search(js)
    if not m:
        sys.exit(f"could not find {var_name}")
    return m.group(1)


def extract_string_const(js: str, var_name: str) -> str:
    """Extract a `const NAME = \`...\`;` value that uses template literals
    (e.g. interpolated paths). Returns the raw template body so callers can
    substitute interpolations themselves."""
    pat = re.compile(rf"const {var_name} = `([^`]*)`;", re.DOTALL)
    m = pat.search(js)
    if not m:
        sys.exit(f"could not find {var_name}")
    return m.group(1)


def resolve_lower(js: str, gender: str, side: str) -> str:
    """Build the muscle HTML for the lower body of front/back, substituting
    the per-leg path constants. side = 'FRONT' or 'BACK'."""
    suffix = "FEMALE" if gender == "female" else "MALE"
    template = extract_string_const(js, f"{side}_MUSCLES_LOWER_{suffix}")
    # Find every `${IDENTIFIER}` and replace with the value of that const.
    def replace(match):
        name = match.group(1)
        # These constants are simple raw path strings.
        pat = re.compile(rf'const {name} = `([^`]*)`;', re.DOTALL)
        m = pat.search(js)
        if not m:
            sys.exit(f"could not find referenced const {name}")
        return m.group(1)
    return re.sub(r"\$\{([A-Z_]+)\}", replace, template)


def img_to_data_uri(path: Path):
    img = Image.open(path).convert("RGBA")
    buf = BytesIO()
    img.save(buf, format="PNG")
    uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return uri, img.size


def build_svg(muscles_html: str, img_uri: str, size: tuple[int, int]) -> str:
    w, h = size
    css = "\n".join(
        f"#m-{mid} {{ fill: none; stroke: {col}; stroke-width: 3; opacity: 1; }}"
        for mid, col in DEBUG_COLORS.items()
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <style>{css}</style>
  <image href="{img_uri}" x="0" y="0" width="{w}" height="{h}"/>
  {muscles_html}
</svg>
"""


def main():
    js = ANATOMY_JS.read_text(encoding="utf-8")
    front_upper = extract_template(js, "FRONT_MUSCLES_UPPER")
    back_upper = extract_template(js, "BACK_MUSCLES_UPPER")

    OUT_DIR.mkdir(exist_ok=True)
    for gender, (front_path, back_path) in IMAGES.items():
        front_html = front_upper + "\n" + resolve_lower(js, gender, "FRONT")
        back_html = back_upper + "\n" + resolve_lower(js, gender, "BACK")
        for name, img_path, html in [
            ("front", front_path, front_html),
            ("back",  back_path,  back_html),
        ]:
            uri, size = img_to_data_uri(img_path)
            svg = build_svg(html, uri, size)
            stem = f"{gender}-{name}"
            (OUT_DIR / f"{stem}.svg").write_text(svg, encoding="utf-8")
            out_w = size[0] * 2
            cairosvg.svg2png(
                bytestring=svg.encode("utf-8"),
                write_to=str(OUT_DIR / f"{stem}.png"),
                output_width=out_w,
            )
            print(f"wrote {OUT_DIR / (stem + '.png')}  ({out_w}x{size[1]*2})")


if __name__ == "__main__":
    main()
