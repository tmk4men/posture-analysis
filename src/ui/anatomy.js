// Anatomy diagram: uses a hand-painted base image of front + back human
// figures, with invisible muscle-region <path> overlays. Each overlay has
// id="m-<muscleId>"; the AI classifies muscles into weak/tight, and the
// overlay is coloured (mix-blend-mode multiply) so the base illustration
// shows through.

const V = new URL(import.meta.url).search;
const { MUSCLES } = await import("../data/muscles.js" + V);

// Colours
const COLOR_WEAK = "#3b8a4f"; // green — 鍛えるべき筋肉
const COLOR_TIGHT = "#d97a26"; // orange — ほぐすべき筋肉

// Base image paths (relative to the deployed site root).
const FRONT_IMG = `assets/anatomy-front.webp${V}`;
const BACK_IMG = `assets/anatomy-back.webp${V}`;

// SVG viewBox matches each image's pixel dimensions so muscle overlay paths
// can be specified in raw image coordinates.
const FRONT_W = 440;
const FRONT_H = 1202;
const BACK_W = 446;
const BACK_H = 1192;

// Muscle overlay paths — positioned over anatomical regions on each image.
const FRONT_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-deep_neck_flexors"
        d="M 198 230
           Q 220 224 242 230
           L 242 280
           L 198 280 Z"/>
  <path id="m-pectorals"
        d="M 132 320
           C 120 380, 148 432, 200 440
           L 240 440
           C 292 432, 320 380, 308 320
           C 290 312, 258 314, 230 326
           L 220 330
           L 210 326
           C 182 314, 150 312, 132 320 Z"/>
  <path id="m-abdominals"
        d="M 188 455
           C 184 520, 186 600, 198 680
           C 202 700, 210 712, 218 714
           L 222 714
           C 230 712, 238 700, 242 680
           C 254 600, 256 520, 252 455
           C 240 462, 220 464, 220 464
           C 220 464, 200 462, 188 455 Z"/>
</g>
`;

const BACK_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-upper_traps"
        d="M 222 230
           C 278 246, 304 290, 308 338
           L 138 338
           C 142 290, 168 246, 222 230 Z"/>
  <path id="m-scapular_stabilizers"
        d="M 150 350
           C 142 408, 162 466, 188 478
           L 215 478
           L 215 356
           C 200 352, 180 350, 162 350
           C 158 350, 154 350, 150 350 Z
           M 294 350
           C 302 408, 282 466, 256 478
           L 229 478
           L 229 356
           C 244 352, 264 350, 282 350
           C 286 350, 290 350, 294 350 Z"/>
  <path id="m-erector_spinae"
        d="M 196 488
           C 192 550, 194 630, 200 690
           L 218 690
           L 218 488 Z
           M 248 488
           C 252 550, 250 630, 244 690
           L 226 690
           L 226 488 Z"/>
  <path id="m-glutes"
        d="M 130 706
           C 122 800, 168 846, 206 846
           C 218 846, 220 826, 220 802
           L 220 740
           C 192 706, 152 706, 130 706 Z
           M 314 706
           C 322 800, 276 846, 238 846
           C 226 846, 224 826, 224 802
           L 224 740
           C 252 706, 292 706, 314 706 Z"/>
  <path id="m-hamstrings"
        d="M 142 858
           C 132 940, 146 1020, 168 1028
           L 218 1028
           C 222 940, 222 860, 218 858
           C 196 854, 162 854, 142 858 Z
           M 302 858
           C 312 940, 298 1020, 276 1028
           L 226 1028
           C 222 940, 222 860, 226 858
           C 248 854, 282 854, 302 858 Z"/>
</g>
`;

function frontSvg() {
  return `
<svg class="anatomy-svg" viewBox="0 0 ${FRONT_W} ${FRONT_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${FRONT_IMG}" x="0" y="0" width="${FRONT_W}" height="${FRONT_H}" preserveAspectRatio="xMidYMid meet"/>
  ${FRONT_MUSCLES}
</svg>`;
}

function backSvg() {
  return `
<svg class="anatomy-svg" viewBox="0 0 ${BACK_W} ${BACK_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${BACK_IMG}" x="0" y="0" width="${BACK_W}" height="${BACK_H}" preserveAspectRatio="xMidYMid meet"/>
  ${BACK_MUSCLES}
</svg>`;
}

// Build the full anatomy panel HTML with front+back side by side and a legend.
// `weakIds` and `tightIds` are arrays of muscle IDs (matching `m-<id>` paths).
export function renderAnatomyPanel(weakIds = [], tightIds = []) {
  const weakSet = new Set(weakIds);
  const tightSet = new Set(tightIds);

  // Highlighted overlays use mix-blend-mode: multiply so the underlying
  // illustration's shading still shows through the colour wash.
  const styleRules = MUSCLES.map((m) => {
    if (weakSet.has(m.id)) {
      return `.anatomy-panel #m-${m.id} { fill: ${COLOR_WEAK}; opacity: 0.55; mix-blend-mode: multiply; }`;
    }
    if (tightSet.has(m.id)) {
      return `.anatomy-panel #m-${m.id} { fill: ${COLOR_TIGHT}; opacity: 0.55; mix-blend-mode: multiply; }`;
    }
    return "";
  })
    .filter(Boolean)
    .join("\n");

  return `
<div class="anatomy-panel">
  <style>${styleRules}</style>
  <div class="anatomy-views">
    <div class="anatomy-view">${frontSvg()}<div class="anatomy-view__caption">前面</div></div>
    <div class="anatomy-view">${backSvg()}<div class="anatomy-view__caption">背面</div></div>
  </div>
  <div class="anatomy-legend">
    <span class="legend-item"><span class="legend-swatch swatch-weak"></span>鍛えるべき筋肉</span>
    <span class="legend-item"><span class="legend-swatch swatch-tight"></span>ほぐすべき筋肉</span>
  </div>
</div>
`;
}

export const ANATOMY_COLORS = { weak: COLOR_WEAK, tight: COLOR_TIGHT, neutral: "#cdb89a" };
