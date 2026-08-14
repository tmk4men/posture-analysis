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

import { MUSCLES } from "../data/muscles.js?v=20260814-1539";

// 画像URLに付けるキャッシュバスター。自分の URL の ?v= をそのまま引き継ぐ。
const V = new URL(import.meta.url).search;

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
  iliopsoas:            { anchorX: 252, anchorY: 540, labelX: 372, labelY: 540, align: "start" },
  quadriceps:           { anchorX: 280, anchorY: 790, labelX: 372, labelY: 790, align: "start" },
  adductors:            { anchorX: 195, anchorY: 760, labelX: 70,  labelY: 760, align: "end"   },
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
// Iliopsoas: anatomically deep hip flexor running from lumbar vertebrae
// (psoas major) and iliac fossa (iliacus) down to the lesser trochanter.
// Drawn as two fan-shaped regions in the lower lumbar/iliac area on each
// side of the rectus abdominis — NOT over the pubis (which would be the
// pectineus/恥骨筋群, a different muscle group entirely).
const FRONT_ILIOPSOAS_PATH = `M 158 455
           C 150 510, 158 575, 200 645
           L 220 645
           L 220 462
           C 200 455, 175 453, 158 455 Z
           M 282 455
           C 290 510, 282 575, 240 645
           L 220 645
           L 220 462
           C 240 455, 265 453, 282 455 Z`;

// Per-leg paths derived from 20-px-step silhouette samples of each asset.
// Outer edge tracks the lateral leg boundary (pinches inward at mid-thigh,
// bulges back at the knee); inner edge tracks the medial boundary that
// moves AWAY from the centerline as the legs spread downward.
const FRONT_QUAD_LEFT_MALE = `M 84 680
           C 92 760, 102 840, 84 920
           L 180 920
           C 178 820, 202 720, 217 680
           C 198 673, 106 673, 84 680 Z`;
const FRONT_QUAD_RIGHT_MALE = `M 356 680
           C 348 760, 338 840, 356 920
           L 260 920
           C 262 820, 238 720, 223 680
           C 242 673, 334 673, 356 680 Z`;
const FRONT_QUAD_LEFT_FEMALE = `M 90 680
           C 98 770, 108 850, 92 920
           L 187 920
           C 185 820, 207 720, 217 680
           C 198 673, 110 673, 90 680 Z`;
const FRONT_QUAD_RIGHT_FEMALE = `M 350 680
           C 342 770, 332 850, 348 920
           L 253 920
           C 255 820, 233 720, 223 680
           C 242 673, 330 673, 350 680 Z`;

// Adductors fan out from the pubis (narrow at top) down the inner thigh
// (wider at bottom). Female pelvis is slightly wider so the top sits a few
// px further from the centerline.
// Inner-edge bottom x kept just inside the leg's medial silhouette
// (innerL=181/innerR=259 at y=820 male; innerL=189/innerR=251 female)
// so the strip doesn't bleed into the inter-leg gap.
const FRONT_ADDUCTOR_LEFT_MALE = `M 202 660
           L 217 660
           L 178 820
           L 145 820 Z`;
const FRONT_ADDUCTOR_RIGHT_MALE = `M 238 660
           L 223 660
           L 262 820
           L 295 820 Z`;
const FRONT_ADDUCTOR_LEFT_FEMALE = `M 200 660
           L 217 660
           L 186 820
           L 150 820 Z`;
const FRONT_ADDUCTOR_RIGHT_FEMALE = `M 240 660
           L 223 660
           L 254 820
           L 290 820 Z`;

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
        d="M 122 360
           C 122 450, 104 540, 96 600
           L 198 600
           L 198 365
           C 178 362, 148 360, 132 360
           C 126 360, 124 360, 122 360 Z
           M 324 360
           C 324 450, 342 540, 350 600
           L 248 600
           L 248 365
           C 268 362, 298 360, 314 360
           C 320 360, 322 360, 324 360 Z"/>
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

// Hamstrings: top at glute crease (y≈720), bottom just above popliteal fossa
// (y≈925). Cover the full back-of-thigh bulk to lateral edges.
const BACK_HAM_LEFT_MALE = `M 86 720
           C 94 800, 102 880, 86 925
           L 180 925
           C 178 815, 202 730, 209 720
           C 188 714, 108 714, 86 720 Z`;
const BACK_HAM_RIGHT_MALE = `M 360 720
           C 352 800, 344 880, 360 925
           L 266 925
           C 268 815, 244 730, 237 720
           C 258 714, 338 714, 360 720 Z`;
const BACK_HAM_LEFT_FEMALE = `M 93 720
           C 100 800, 108 880, 95 925
           L 187 925
           C 185 815, 202 730, 209 720
           C 188 714, 115 714, 93 720 Z`;
const BACK_HAM_RIGHT_FEMALE = `M 353 720
           C 346 800, 338 880, 351 925
           L 259 925
           C 261 815, 244 730, 237 720
           C 258 714, 331 714, 353 720 Z`;

// Calves (gastrocnemius+soleus = 下腿三頭筋): from just below knee crease
// (y≈930) down past mid-shin to where the achilles tendon narrows
// (y≈1130). Cover the full muscle bulge on both medial and lateral sides.
const BACK_CALF_LEFT_MALE = `M 84 930
           C 88 1010, 98 1080, 106 1135
           L 160 1135
           C 162 1020, 182 950, 184 930
           C 162 924, 106 924, 84 930 Z`;
const BACK_CALF_RIGHT_MALE = `M 360 930
           C 356 1010, 346 1080, 338 1135
           L 284 1135
           C 282 1020, 262 950, 260 930
           C 282 924, 338 924, 360 930 Z`;
const BACK_CALF_LEFT_FEMALE = `M 96 930
           C 102 1010, 114 1080, 122 1135
           L 170 1135
           C 172 1020, 188 950, 191 930
           C 170 924, 116 924, 96 930 Z`;
const BACK_CALF_RIGHT_FEMALE = `M 350 930
           C 344 1010, 332 1080, 324 1135
           L 276 1135
           C 274 1020, 258 950, 255 930
           C 276 924, 330 924, 350 930 Z`;

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
