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

// Anchor points for muscle-name callout labels — placed near each region,
// with a leader line back to the highlighted overlay so the label can sit
// outside the body silhouette and stay legible. anchorX/anchorY = the point
// the leader line ends at on the muscle; labelX/labelY = where the text sits.
const FRONT_LABEL_ANCHORS = {
  deep_neck_flexors:    { anchorX: 220, anchorY: 210, labelX: 372, labelY: 210, align: "start" },
  pectorals:            { anchorX: 220, anchorY: 320, labelX: 372, labelY: 300, align: "start" },
  abdominals:           { anchorX: 220, anchorY: 500, labelX: 372, labelY: 500, align: "start" },
};

const BACK_LABEL_ANCHORS = {
  upper_traps:           { anchorX: 222, anchorY: 190, labelX: 374, labelY: 170, align: "start" },
  scapular_stabilizers:  { anchorX: 295, anchorY: 300, labelX: 374, labelY: 310, align: "start" },
  erector_spinae:        { anchorX: 222, anchorY: 440, labelX: 70,  labelY: 430, align: "end"   },
  glutes:                { anchorX: 222, anchorY: 595, labelX: 374, labelY: 595, align: "start" },
  hamstrings:            { anchorX: 222, anchorY: 760, labelX: 70,  labelY: 760, align: "end"   },
};

// Muscle overlay paths — positioned over anatomical regions on each image.
const FRONT_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-deep_neck_flexors"
        d="M 198 185
           Q 220 179 242 185
           L 242 235
           L 198 235 Z"/>
  <path id="m-pectorals"
        d="M 132 255
           C 120 317, 148 373, 200 381
           L 240 381
           C 292 373, 320 317, 308 255
           C 290 247, 258 249, 230 261
           L 220 265
           L 210 261
           C 182 249, 150 247, 132 255 Z"/>
  <path id="m-abdominals"
        d="M 190 380
           C 186 440, 188 520, 198 590
           C 202 606, 210 615, 218 616
           L 222 616
           C 230 615, 238 606, 242 590
           C 252 520, 254 440, 250 380
           C 238 386, 220 388, 220 388
           C 220 388, 202 386, 190 380 Z"/>
</g>
`;

const BACK_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-upper_traps"
        d="M 222 135
           C 278 151, 304 195, 308 243
           L 138 243
           C 142 195, 168 151, 222 135 Z"/>
  <path id="m-scapular_stabilizers"
        d="M 150 240
           C 142 298, 162 356, 188 368
           L 215 368
           L 215 246
           C 200 242, 180 240, 162 240
           C 158 240, 154 240, 150 240 Z
           M 294 240
           C 302 298, 282 356, 256 368
           L 229 368
           L 229 246
           C 244 242, 264 240, 282 240
           C 286 240, 290 240, 294 240 Z"/>
  <path id="m-erector_spinae"
        d="M 196 330
           C 192 400, 194 460, 200 518
           L 218 518
           L 218 330 Z
           M 248 330
           C 252 400, 250 460, 244 518
           L 226 518
           L 226 330 Z"/>
  <path id="m-glutes"
        d="M 132 532
           C 124 618, 168 662, 206 662
           C 218 662, 220 648, 220 626
           L 220 566
           C 192 532, 154 532, 132 532 Z
           M 312 532
           C 320 618, 276 662, 238 662
           C 226 662, 224 648, 224 626
           L 224 566
           C 252 532, 290 532, 312 532 Z"/>
  <path id="m-hamstrings"
        d="M 144 672
           C 134 754, 148 838, 170 846
           L 218 846
           C 222 756, 222 676, 218 672
           C 196 668, 164 668, 144 672 Z
           M 300 672
           C 310 754, 296 838, 274 846
           L 226 846
           C 222 756, 222 676, 226 672
           C 248 668, 280 668, 300 672 Z"/>
</g>
`;

// Build callout-label SVG markup for the highlighted muscles only.  Labels
// sit beside the figure with a thin leader line pointing back to the muscle,
// so the patient can read both the colour and the name at a glance.
function buildLabels(anchors, weakSet, tightSet) {
  const lines = [];
  for (const [muscleId, pos] of Object.entries(anchors)) {
    let role = null;
    if (weakSet.has(muscleId)) role = "weak";
    else if (tightSet.has(muscleId)) role = "tight";
    if (!role) continue;

    const def = MUSCLES.find((m) => m.id === muscleId);
    if (!def) continue;
    const text = def.label;

    lines.push(`
      <g class="muscle-label muscle-label--${role}">
        <line class="muscle-label__leader"
              x1="${pos.anchorX}" y1="${pos.anchorY}"
              x2="${pos.labelX}"  y2="${pos.labelY}"/>
        <rect class="muscle-label__bg"
              x="${pos.align === "end" ? pos.labelX - 150 : pos.labelX - 4}"
              y="${pos.labelY - 16}"
              width="154" height="26" rx="6" ry="6"/>
        <text class="muscle-label__text"
              x="${pos.labelX}" y="${pos.labelY}"
              text-anchor="${pos.align}">${escapeXml(text)}</text>
      </g>`);
  }
  return lines.join("\n");
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function frontSvg(weakSet, tightSet) {
  return `
<svg class="anatomy-svg" viewBox="0 0 ${FRONT_W} ${FRONT_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${FRONT_IMG}" x="0" y="0" width="${FRONT_W}" height="${FRONT_H}" preserveAspectRatio="xMidYMid meet"/>
  ${FRONT_MUSCLES}
  ${buildLabels(FRONT_LABEL_ANCHORS, weakSet, tightSet)}
</svg>`;
}

function backSvg(weakSet, tightSet) {
  return `
<svg class="anatomy-svg" viewBox="0 0 ${BACK_W} ${BACK_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${BACK_IMG}" x="0" y="0" width="${BACK_W}" height="${BACK_H}" preserveAspectRatio="xMidYMid meet"/>
  ${BACK_MUSCLES}
  ${buildLabels(BACK_LABEL_ANCHORS, weakSet, tightSet)}
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
    <div class="anatomy-view">${frontSvg(weakSet, tightSet)}<div class="anatomy-view__caption">前面</div></div>
    <div class="anatomy-view">${backSvg(weakSet, tightSet)}<div class="anatomy-view__caption">背面</div></div>
  </div>
  <div class="anatomy-legend">
    <span class="legend-item"><span class="legend-swatch swatch-weak"></span>鍛えるべき筋肉</span>
    <span class="legend-item"><span class="legend-swatch swatch-tight"></span>ほぐすべき筋肉</span>
  </div>
</div>
`;
}

export const ANATOMY_COLORS = { weak: COLOR_WEAK, tight: COLOR_TIGHT, neutral: "#cdb89a" };
