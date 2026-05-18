// Anatomy diagram: uses a hand-painted base image of front + back human
// figures, with invisible muscle-region <path> overlays. Each overlay has
// id="m-<muscleId>"; the AI classifies muscles into weak/tight, and the
// overlay is coloured (mix-blend-mode multiply) so the base illustration
// shows through.
//
// The female illustration shares the canvas size with the male, but the
// thighs and calves sit slightly closer to the centerline (legs less spread
// than the male figure in this artwork). Because the difference is uneven —
// the gap varies by y down the leg — there is no single shift that fits
// both. Each per-leg lower-body muscle therefore has separate _MALE / _FEMALE
// path constants tracing the actual silhouette of each figure.

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

// Label leader-line anchors point at the highlighted muscle overlay. Because
// the female lower-body overlays have their own paths (positioned slightly
// closer to the centerline than the male's), per-muscle anchor offsets shift
// each leader so it still lands on the overlay. Keys = muscle id; values =
// signed dx (anchorY unchanged). Side-specific muscles only — centerline
// muscles (iliopsoas, glutes, calves anchor) keep the male anchors.
const FEMALE_ANCHOR_DX = {
  quadriceps: -8,      // front right leg (its inner edge sits ~8 px closer to center)
  adductors:  +8,      // front left adductor (inner thigh) sits ~8 px closer to center
  hamstrings: -8,      // back right leg
  gluteus_medius: +6,  // back left hip
};

// Muscle overlay paths — positioned over anatomical regions on each image.
// Split upper/lower so the lower group can be transformed independently for
// the female figure.
const FRONT_MUSCLES_UPPER = `
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
`;
// Iliopsoas crosses the centerline (groin/pubic area) so the same path
// works for both figures.
const FRONT_ILIOPSOAS_PATH = `M 175 560
           C 168 605, 178 640, 200 648
           L 240 648
           C 262 640, 272 605, 265 560
           C 248 564, 220 568, 220 568
           C 220 568, 192 564, 175 560 Z`;

// Per-leg paths derived from 20-px-step silhouette samples of each asset.
// Outer edge tracks the lateral leg boundary (pinches inward at mid-thigh,
// bulges back at the knee); inner edge tracks the medial boundary that
// moves AWAY from the centerline as the legs spread downward.
const FRONT_QUAD_LEFT_MALE = `M 88 680
           C 95 760, 105 830, 95 905
           L 175 905
           C 173 820, 200 720, 213 680
           C 195 675, 110 675, 88 680 Z`;
const FRONT_QUAD_RIGHT_MALE = `M 352 680
           C 345 760, 335 830, 345 905
           L 265 905
           C 267 820, 240 720, 227 680
           C 245 675, 330 675, 352 680 Z`;
const FRONT_QUAD_LEFT_FEMALE = `M 91 680
           C 100 770, 110 840, 100 905
           L 183 905
           C 181 820, 205 720, 213 680
           C 195 675, 112 675, 91 680 Z`;
const FRONT_QUAD_RIGHT_FEMALE = `M 349 680
           C 340 770, 330 840, 340 905
           L 257 905
           C 259 820, 235 720, 227 680
           C 245 675, 328 675, 349 680 Z`;

// Adductors fan out from the pubis (narrow at top) down the inner thigh
// (wider at bottom). Female pelvis is slightly wider so the top sits a few
// px further from the centerline.
const FRONT_ADDUCTOR_LEFT_MALE = `M 200 640
           L 217 640
           L 188 800
           L 152 800 Z`;
const FRONT_ADDUCTOR_RIGHT_MALE = `M 240 640
           L 223 640
           L 252 800
           L 288 800 Z`;
const FRONT_ADDUCTOR_LEFT_FEMALE = `M 198 640
           L 217 640
           L 193 800
           L 158 800 Z`;
const FRONT_ADDUCTOR_RIGHT_FEMALE = `M 242 640
           L 223 640
           L 247 800
           L 282 800 Z`;

const FRONT_MUSCLES_LOWER_MALE = `
  <path id="m-iliopsoas" d="${FRONT_ILIOPSOAS_PATH}"/>
  <path id="m-quadriceps" d="${FRONT_QUAD_LEFT_MALE} ${FRONT_QUAD_RIGHT_MALE}"/>
  <path id="m-adductors" d="${FRONT_ADDUCTOR_LEFT_MALE} ${FRONT_ADDUCTOR_RIGHT_MALE}"/>
`;

const FRONT_MUSCLES_LOWER_FEMALE = `
  <path id="m-iliopsoas" d="${FRONT_ILIOPSOAS_PATH}"/>
  <path id="m-quadriceps" d="${FRONT_QUAD_LEFT_FEMALE} ${FRONT_QUAD_RIGHT_FEMALE}"/>
  <path id="m-adductors" d="${FRONT_ADDUCTOR_LEFT_FEMALE} ${FRONT_ADDUCTOR_RIGHT_FEMALE}"/>
`;

const BACK_MUSCLES_UPPER = `
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
        d="M 130 355
           C 108 430, 116 495, 150 515
           L 192 515
           L 192 360
           C 175 358, 158 356, 144 355
           C 138 355, 134 355, 130 355 Z
           M 316 355
           C 338 430, 330 495, 296 515
           L 254 515
           L 254 360
           C 271 358, 288 356, 302 355
           C 308 355, 312 355, 316 355 Z"/>
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
`;
// Glutes meet at the cleft (centerline) so the path works for both figures.
const BACK_GLUTES_PATH = `M 132 560
           C 112 680, 165 730, 208 730
           C 220 730, 222 712, 222 682
           L 222 582
           C 196 555, 156 555, 132 560 Z
           M 314 560
           C 334 680, 281 730, 238 730
           C 226 730, 224 712, 224 682
           L 224 582
           C 250 555, 290 555, 314 560 Z`;

// Gluteus medius sits on the upper outer hip — small triangular patch.
const BACK_GMED_LEFT_MALE = `M 98 540
           C 88 610, 112 650, 138 650
           L 156 650
           C 158 618, 148 568, 134 542
           C 120 534, 106 534, 98 540 Z`;
const BACK_GMED_RIGHT_MALE = `M 348 540
           C 358 610, 334 650, 308 650
           L 290 650
           C 288 618, 298 568, 312 542
           C 326 534, 340 534, 348 540 Z`;
const BACK_GMED_LEFT_FEMALE = `M 102 540
           C 92 610, 116 650, 142 650
           L 160 650
           C 162 618, 152 568, 138 542
           C 124 534, 110 534, 102 540 Z`;
const BACK_GMED_RIGHT_FEMALE = `M 344 540
           C 354 610, 330 650, 304 650
           L 286 650
           C 284 618, 294 568, 308 542
           C 322 534, 336 534, 344 540 Z`;

// Hamstrings: top at glute crease (y≈720), bottom at popliteal fossa (y≈895).
// Inner edge spreads outward (away from centerline) going down.
const BACK_HAM_LEFT_MALE = `M 91 720
           C 100 800, 108 870, 92 895
           L 175 895
           C 173 800, 200 730, 207 720
           C 188 716, 113 716, 91 720 Z`;
const BACK_HAM_RIGHT_MALE = `M 355 720
           C 346 800, 338 870, 354 895
           L 271 895
           C 273 800, 246 730, 239 720
           C 258 716, 333 716, 355 720 Z`;
const BACK_HAM_LEFT_FEMALE = `M 97 720
           C 105 800, 112 870, 100 895
           L 183 895
           C 181 800, 200 730, 207 720
           C 188 716, 118 716, 97 720 Z`;
const BACK_HAM_RIGHT_FEMALE = `M 349 720
           C 341 800, 334 870, 346 895
           L 263 895
           C 265 800, 246 730, 239 720
           C 258 716, 328 716, 349 720 Z`;

// Calves: gastrocnemius bulk from just below knee (y≈935) to mid-shin.
const BACK_CALF_LEFT_MALE = `M 88 935
           C 92 1000, 100 1060, 108 1085
           L 155 1085
           C 158 1010, 178 950, 180 935
           C 162 930, 110 930, 88 935 Z`;
const BACK_CALF_RIGHT_MALE = `M 358 935
           C 354 1000, 346 1060, 338 1085
           L 291 1085
           C 288 1010, 268 950, 266 935
           C 284 930, 336 930, 358 935 Z`;
const BACK_CALF_LEFT_FEMALE = `M 102 940
           C 108 1000, 118 1060, 124 1085
           L 165 1085
           C 168 1010, 184 950, 187 940
           C 170 932, 120 932, 102 940 Z`;
const BACK_CALF_RIGHT_FEMALE = `M 344 940
           C 338 1000, 328 1060, 322 1085
           L 281 1085
           C 278 1010, 262 950, 259 940
           C 276 932, 326 932, 344 940 Z`;

const BACK_MUSCLES_LOWER_MALE = `
  <path id="m-glutes" d="${BACK_GLUTES_PATH}"/>
  <path id="m-gluteus_medius" d="${BACK_GMED_LEFT_MALE} ${BACK_GMED_RIGHT_MALE}"/>
  <path id="m-hamstrings" d="${BACK_HAM_LEFT_MALE} ${BACK_HAM_RIGHT_MALE}"/>
  <path id="m-calves" d="${BACK_CALF_LEFT_MALE} ${BACK_CALF_RIGHT_MALE}"/>
`;

const BACK_MUSCLES_LOWER_FEMALE = `
  <path id="m-glutes" d="${BACK_GLUTES_PATH}"/>
  <path id="m-gluteus_medius" d="${BACK_GMED_LEFT_FEMALE} ${BACK_GMED_RIGHT_FEMALE}"/>
  <path id="m-hamstrings" d="${BACK_HAM_LEFT_FEMALE} ${BACK_HAM_RIGHT_FEMALE}"/>
  <path id="m-calves" d="${BACK_CALF_LEFT_FEMALE} ${BACK_CALF_RIGHT_FEMALE}"/>
`;

// Build callout-label SVG markup for the highlighted muscles only.  Labels
// sit beside the figure with a thin leader line pointing back to the muscle,
// so the patient can read both the colour and the name at a glance.
function buildLabels(anchors, weakSet, tightSet, opts = {}) {
  const { gender = "male" } = opts;
  const lines = [];
  for (const [muscleId, pos] of Object.entries(anchors)) {
    let role = null;
    if (weakSet.has(muscleId)) role = "weak";
    else if (tightSet.has(muscleId)) role = "tight";
    if (!role) continue;

    const def = MUSCLES.find((m) => m.id === muscleId);
    if (!def) continue;
    const text = def.label;

    let anchorX = pos.anchorX;
    let anchorY = pos.anchorY;
    if (gender === "female" && FEMALE_ANCHOR_DX[muscleId] != null) {
      anchorX += FEMALE_ANCHOR_DX[muscleId];
    }

    lines.push(`
      <g class="muscle-label muscle-label--${role}">
        <line class="muscle-label__leader"
              x1="${anchorX}" y1="${anchorY}"
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
  const lower = gender === "female" ? FRONT_MUSCLES_LOWER_FEMALE : FRONT_MUSCLES_LOWER_MALE;
  return `
<svg class="anatomy-svg" viewBox="0 0 ${FRONT_W} ${FRONT_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${FRONT_IMG[gender]}" x="0" y="0" width="${FRONT_W}" height="${FRONT_H}" preserveAspectRatio="xMidYMid meet"/>
  <g class="muscle-overlay" fill="transparent" stroke="none">
    ${FRONT_MUSCLES_UPPER}
    ${lower}
  </g>
  ${buildLabels(FRONT_LABEL_ANCHORS, weakSet, tightSet, { gender })}
</svg>`;
}

function backSvg(weakSet, tightSet, gender) {
  const lower = gender === "female" ? BACK_MUSCLES_LOWER_FEMALE : BACK_MUSCLES_LOWER_MALE;
  return `
<svg class="anatomy-svg" viewBox="0 0 ${BACK_W} ${BACK_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="${BACK_IMG[gender]}" x="0" y="0" width="${BACK_W}" height="${BACK_H}" preserveAspectRatio="xMidYMid meet"/>
  <g class="muscle-overlay" fill="transparent" stroke="none">
    ${BACK_MUSCLES_UPPER}
    ${lower}
  </g>
  ${buildLabels(BACK_LABEL_ANCHORS, weakSet, tightSet, { gender })}
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
