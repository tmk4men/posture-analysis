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
const FRONT_IMG = {
  male: `assets/anatomy-front.webp${V}`,
  female: `assets/anatomy-female-front.webp${V}`,
};
const BACK_IMG = {
  male: `assets/anatomy-back.webp${V}`,
  female: `assets/anatomy-female-back.webp${V}`,
};

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
  deep_neck_flexors:    { anchorX: 220, anchorY: 210, labelX: 372, labelY: 200, align: "start" },
  anterior_deltoid:     { anchorX: 110, anchorY: 290, labelX: 70,  labelY: 280, align: "end"   },
  pectorals:            { anchorX: 280, anchorY: 320, labelX: 372, labelY: 310, align: "start" },
  biceps:               { anchorX: 95,  anchorY: 400, labelX: 70,  labelY: 400, align: "end"   },
  obliques:             { anchorX: 295, anchorY: 470, labelX: 372, labelY: 470, align: "start" },
  abdominals:           { anchorX: 220, anchorY: 470, labelX: 70,  labelY: 480, align: "end"   },
  iliopsoas:            { anchorX: 240, anchorY: 605, labelX: 372, labelY: 605, align: "start" },
  quadriceps:           { anchorX: 280, anchorY: 790, labelX: 372, labelY: 790, align: "start" },
  adductors:            { anchorX: 195, anchorY: 800, labelX: 70,  labelY: 800, align: "end"   },
};

const BACK_LABEL_ANCHORS = {
  upper_traps:           { anchorX: 222, anchorY: 190, labelX: 374, labelY: 170, align: "start" },
  posterior_deltoid:     { anchorX: 115, anchorY: 290, labelX: 70,  labelY: 280, align: "end"   },
  scapular_stabilizers:  { anchorX: 295, anchorY: 320, labelX: 374, labelY: 320, align: "start" },
  lats:                  { anchorX: 130, anchorY: 445, labelX: 70,  labelY: 440, align: "end"   },
  triceps:               { anchorX: 345, anchorY: 400, labelX: 374, labelY: 400, align: "start" },
  erector_spinae:        { anchorX: 222, anchorY: 480, labelX: 70,  labelY: 480, align: "end"   },
  glutes:                { anchorX: 295, anchorY: 635, labelX: 374, labelY: 635, align: "start" },
  gluteus_medius:        { anchorX: 125, anchorY: 590, labelX: 70,  labelY: 590, align: "end"   },
  hamstrings:            { anchorX: 295, anchorY: 800, labelX: 374, labelY: 800, align: "start" },
  calves:                { anchorX: 222, anchorY: 1010, labelX: 70, labelY: 1010, align: "end"  },
};

// Muscle overlay paths — positioned over anatomical regions on each image.
const FRONT_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-deep_neck_flexors"
        d="M 198 185
           Q 220 179 242 185
           L 242 235
           L 198 235 Z"/>
  <path id="m-anterior_deltoid"
        d="M 88 255
           C 75 295, 95 325, 132 332
           L 152 332
           L 152 270
           C 130 250, 102 250, 88 255 Z
           M 352 255
           C 365 295, 345 325, 308 332
           L 288 332
           L 288 270
           C 310 250, 338 250, 352 255 Z"/>
  <path id="m-pectorals"
        d="M 132 255
           C 120 317, 148 373, 200 381
           L 240 381
           C 292 373, 320 317, 308 255
           C 290 247, 258 249, 230 261
           L 220 265
           L 210 261
           C 182 249, 150 247, 132 255 Z"/>
  <path id="m-biceps"
        d="M 70 320
           C 60 390, 72 445, 100 455
           L 122 455
           C 130 400, 130 330, 122 322
           C 105 316, 82 316, 70 320 Z
           M 370 320
           C 380 390, 368 445, 340 455
           L 318 455
           C 310 400, 310 330, 318 322
           C 335 316, 358 316, 370 320 Z"/>
  <path id="m-obliques"
        d="M 122 395
           C 115 470, 120 540, 148 560
           L 188 560
           L 188 395
           C 170 390, 140 390, 122 395 Z
           M 318 395
           C 325 470, 320 540, 292 560
           L 252 560
           L 252 395
           C 270 390, 300 390, 318 395 Z"/>
  <path id="m-abdominals"
        d="M 190 380
           C 186 430, 188 490, 198 540
           C 202 552, 210 558, 218 560
           L 222 560
           C 230 558, 238 552, 242 540
           C 252 490, 254 430, 250 380
           C 238 386, 220 388, 220 388
           C 220 388, 202 386, 190 380 Z"/>
  <path id="m-iliopsoas"
        d="M 175 560
           C 168 605, 178 640, 200 648
           L 240 648
           C 262 640, 272 605, 265 560
           C 248 564, 220 568, 220 568
           C 220 568, 192 564, 175 560 Z"/>
  <path id="m-quadriceps"
        d="M 128 670
           C 120 770, 142 880, 162 920
           L 215 920
           C 218 800, 218 685, 215 670
           C 196 665, 152 665, 128 670 Z
           M 312 670
           C 320 770, 298 880, 278 920
           L 225 920
           C 222 800, 222 685, 225 670
           C 244 665, 288 665, 312 670 Z"/>
  <path id="m-adductors"
        d="M 170 680
           C 174 770, 188 855, 205 885
           L 215 885
           C 218 800, 218 685, 215 680
           L 170 680 Z
           M 270 680
           C 266 770, 252 855, 235 885
           L 225 885
           C 222 800, 222 685, 225 680
           L 270 680 Z"/>
</g>
`;

const BACK_MUSCLES = `
<g class="muscle-overlay" fill="transparent" stroke="none">
  <path id="m-upper_traps"
        d="M 222 165
           C 278 181, 304 220, 308 258
           L 138 258
           C 142 220, 168 181, 222 165 Z"/>
  <path id="m-posterior_deltoid"
        d="M 92 255
           C 78 295, 96 330, 132 338
           L 152 338
           L 152 275
           C 130 252, 105 252, 92 255 Z
           M 354 255
           C 368 295, 350 330, 314 338
           L 294 338
           L 294 275
           C 316 252, 341 252, 354 255 Z"/>
  <path id="m-scapular_stabilizers"
        d="M 150 275
           C 142 333, 162 391, 188 403
           L 215 403
           L 215 281
           C 200 277, 180 275, 162 275
           C 158 275, 154 275, 150 275 Z
           M 294 275
           C 302 333, 282 391, 256 403
           L 229 403
           L 229 281
           C 244 277, 264 275, 282 275
           C 286 275, 290 275, 294 275 Z"/>
  <path id="m-lats"
        d="M 116 380
           C 108 440, 118 490, 150 505
           L 188 505
           L 188 395
           C 170 388, 145 380, 130 380
           C 124 380, 120 380, 116 380 Z
           M 330 380
           C 338 440, 328 490, 296 505
           L 258 505
           L 258 395
           C 276 388, 301 380, 316 380
           C 322 380, 326 380, 330 380 Z"/>
  <path id="m-triceps"
        d="M 70 320
           C 60 405, 75 460, 105 470
           L 124 470
           C 130 410, 130 330, 122 322
           C 105 316, 82 316, 70 320 Z
           M 370 320
           C 380 405, 365 460, 335 470
           L 316 470
           C 310 410, 310 330, 318 322
           C 335 316, 358 316, 370 320 Z"/>
  <path id="m-erector_spinae"
        d="M 195 275
           C 190 360, 186 480, 195 590
           L 220 590
           L 220 275 Z
           M 249 275
           C 254 360, 258 480, 249 590
           L 224 590
           L 224 275 Z"/>
  <path id="m-glutes"
        d="M 132 560
           C 112 680, 165 730, 208 730
           C 220 730, 222 712, 222 682
           L 222 582
           C 196 555, 156 555, 132 560 Z
           M 314 560
           C 334 680, 281 730, 238 730
           C 226 730, 224 712, 224 682
           L 224 582
           C 250 555, 290 555, 314 560 Z"/>
  <path id="m-gluteus_medius"
        d="M 108 540
           C 96 608, 116 650, 140 650
           L 158 650
           C 160 618, 154 572, 140 545
           C 126 535, 114 535, 108 540 Z
           M 338 540
           C 350 608, 330 650, 306 650
           L 288 650
           C 286 618, 292 572, 306 545
           C 320 535, 332 535, 338 540 Z"/>
  <path id="m-hamstrings"
        d="M 144 720
           C 134 800, 148 880, 170 895
           L 218 895
           C 222 805, 222 724, 218 720
           C 196 716, 164 716, 144 720 Z
           M 300 720
           C 310 800, 296 880, 274 895
           L 226 895
           C 222 805, 222 724, 226 720
           C 248 716, 280 716, 300 720 Z"/>
  <path id="m-calves"
        d="M 150 935
           C 140 1010, 158 1075, 180 1085
           L 215 1085
           C 218 1010, 218 940, 215 935
           C 196 930, 168 930, 150 935 Z
           M 294 935
           C 304 1010, 286 1075, 264 1085
           L 229 1085
           C 226 1010, 226 940, 229 935
           C 248 930, 276 930, 294 935 Z"/>
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

function frontSvg(weakSet, tightSet, gender) {
  return `
<svg class="anatomy-svg" viewBox="0 0 ${FRONT_W} ${FRONT_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${FRONT_IMG[gender]}" x="0" y="0" width="${FRONT_W}" height="${FRONT_H}" preserveAspectRatio="xMidYMid meet"/>
  ${FRONT_MUSCLES}
  ${buildLabels(FRONT_LABEL_ANCHORS, weakSet, tightSet)}
</svg>`;
}

function backSvg(weakSet, tightSet, gender) {
  return `
<svg class="anatomy-svg" viewBox="0 0 ${BACK_W} ${BACK_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${BACK_IMG[gender]}" x="0" y="0" width="${BACK_W}" height="${BACK_H}" preserveAspectRatio="xMidYMid meet"/>
  ${BACK_MUSCLES}
  ${buildLabels(BACK_LABEL_ANCHORS, weakSet, tightSet)}
</svg>`;
}

// Build the full anatomy panel HTML with front+back side by side and a legend.
// `weakIds` and `tightIds` are arrays of muscle IDs (matching `m-<id>` paths).
export function renderAnatomyPanel(weakIds = [], tightIds = [], gender = "male") {
  const weakSet = new Set(weakIds);
  const tightSet = new Set(tightIds);
  const g = FRONT_IMG[gender] ? gender : "male";

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
    <div class="anatomy-view">${frontSvg(weakSet, tightSet, g)}<div class="anatomy-view__caption">前面</div></div>
    <div class="anatomy-view">${backSvg(weakSet, tightSet, g)}<div class="anatomy-view__caption">背面</div></div>
  </div>
  <div class="anatomy-legend">
    <span class="legend-item"><span class="legend-swatch swatch-weak"></span>鍛えるべき筋肉</span>
    <span class="legend-item"><span class="legend-swatch swatch-tight"></span>ほぐすべき筋肉</span>
  </div>
</div>
`;
}

export const ANATOMY_COLORS = { weak: COLOR_WEAK, tight: COLOR_TIGHT, neutral: "#cdb89a" };
