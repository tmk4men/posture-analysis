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
  deep_neck_flexors:    { anchorX: 220, anchorY: 255, labelX: 372, labelY: 255, align: "start" },
  pectorals:            { anchorX: 220, anchorY: 380, labelX: 372, labelY: 360, align: "start" },
  abdominals:           { anchorX: 220, anchorY: 580, labelX: 372, labelY: 580, align: "start" },
};

const BACK_LABEL_ANCHORS = {
  upper_traps:           { anchorX: 222, anchorY: 290, labelX: 374, labelY: 270, align: "start" },
  scapular_stabilizers:  { anchorX: 295, anchorY: 410, labelX: 374, labelY: 420, align: "start" },
  erector_spinae:        { anchorX: 222, anchorY: 570, labelX: 70,  labelY: 560, align: "end"   },
  glutes:                { anchorX: 222, anchorY: 760, labelX: 374, labelY: 760, align: "start" },
  hamstrings:            { anchorX: 222, anchorY: 920, labelX: 70,  labelY: 920, align: "end"   },
};

// Muscle overlay paths — positioned over anatomical regions on each image.
const FRONT_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-deep_neck_flexors"
        d="M 198 230
           Q 220 224 242 230
           L 242 280
           L 198 280 Z"/>
  <path id="m-pectorals"
        d="M 132 310
           C 120 372, 148 428, 200 436
           L 240 436
           C 292 428, 320 372, 308 310
           C 290 302, 258 304, 230 316
           L 220 320
           L 210 316
           C 182 304, 150 302, 132 310 Z"/>
  <path id="m-abdominals"
        d="M 190 460
           C 186 520, 188 600, 198 670
           C 202 686, 210 695, 218 696
           L 222 696
           C 230 695, 238 686, 242 670
           C 252 600, 254 520, 250 460
           C 238 466, 220 468, 220 468
           C 220 468, 202 466, 190 460 Z"/>
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
        d="M 196 460
           C 192 540, 194 620, 200 678
           L 218 678
           L 218 460 Z
           M 248 460
           C 252 540, 250 620, 244 678
           L 226 678
           L 226 460 Z"/>
  <path id="m-glutes"
        d="M 132 692
           C 124 778, 168 822, 206 822
           C 218 822, 220 808, 220 786
           L 220 726
           C 192 692, 154 692, 132 692 Z
           M 312 692
           C 320 778, 276 822, 238 822
           C 226 822, 224 808, 224 786
           L 224 726
           C 252 692, 290 692, 312 692 Z"/>
  <path id="m-hamstrings"
        d="M 144 832
           C 134 914, 148 998, 170 1006
           L 218 1006
           C 222 916, 222 836, 218 832
           C 196 828, 164 828, 144 832 Z
           M 300 832
           C 310 914, 296 998, 274 1006
           L 226 1006
           C 222 916, 222 836, 226 832
           C 248 828, 280 828, 300 832 Z"/>
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
