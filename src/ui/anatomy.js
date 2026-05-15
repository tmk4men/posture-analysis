// Anatomy diagram: stylised front + back human body with muscle groups
// rendered as individually-targetable paths. Each muscle path has
// id="m-<muscleId>"; colouring is applied via CSS classes on the
// enclosing <svg> element by adding `data-weak` / `data-tight` lists.

const V = new URL(import.meta.url).search;
const { MUSCLES } = await import("../data/muscles.js" + V);

// Colours
const COLOR_WEAK = "#3b8a4f"; // green — 鍛えるべき筋肉
const COLOR_TIGHT = "#d97a26"; // orange — ほぐすべき筋肉
const COLOR_NEUTRAL = "#cdb89a"; // neutral muscle tone

// 8-head proportioned silhouette on a 240x600 viewBox.
// Entire body (head→neck→shoulders→arms→torso→legs→feet) is a single closed path
// so there are no internal seams between sub-shapes. Path traversed clockwise.
// Landmarks (front, center x=120):
//   head top:    y= 14
//   chin:        y=104
//   neck base:   y=112
//   acromion:    y=140 (shoulder peak, x=58 / x=182)
//   armpit:      y=170 (torso edge x=80 / x=160)
//   waist:       y=270 (narrowest x=88 / x=152)
//   hip widest:  y=380 (x=70 / x=170)
//   knee:        y=470
//   ankle:       y=586
//   foot sole:   y=596

const BODY = `
  <path d="
    M 120 14
    C 96 14, 80 34, 80 62
    C 80 84, 88 100, 100 104
    L 104 112
    C 92 120, 76 128, 58 140
    C 48 158, 40 180, 36 202
    C 30 240, 24 280, 24 320
    C 24 360, 30 400, 38 420
    C 40 428, 44 432, 50 432
    L 60 432
    L 60 420
    C 58 400, 54 360, 56 320
    C 56 280, 60 240, 66 200
    C 70 184, 76 176, 80 170
    C 84 200, 88 240, 88 270
    C 86 292, 82 312, 78 332
    C 72 352, 70 360, 70 380
    C 74 412, 80 442, 86 470
    C 84 490, 84 510, 88 540
    C 88 560, 90 580, 92 590
    L 92 596
    L 110 596
    C 113 590, 114 585, 114 580
    C 115 560, 116 540, 117 510
    C 117 490, 117 470, 117 440
    C 118 410, 119 385, 119 365
    L 121 365
    C 122 385, 122 410, 123 440
    C 123 470, 124 490, 124 510
    C 125 540, 126 560, 127 580
    C 127 585, 128 590, 130 596
    L 148 596
    L 148 590
    C 150 580, 152 560, 152 540
    C 156 510, 156 490, 154 470
    C 160 442, 166 412, 170 380
    C 170 360, 168 352, 162 332
    C 158 312, 154 292, 152 270
    C 152 240, 156 200, 160 170
    C 164 176, 170 184, 174 200
    C 180 240, 184 280, 184 320
    C 184 360, 178 400, 174 420
    L 174 432
    L 184 432
    C 190 432, 194 428, 196 420
    C 204 400, 210 360, 210 320
    C 216 280, 210 240, 204 202
    C 200 180, 192 158, 182 140
    C 164 128, 148 120, 136 112
    L 140 104
    C 152 100, 160 84, 160 62
    C 160 34, 144 14, 120 14
    Z"/>
`;

const FRONT_SILHOUETTE = `
<g class="silhouette" fill="#f6e5cf" stroke="#9b7a52" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
  ${BODY}
</g>
`;

const BACK_SILHOUETTE = FRONT_SILHOUETTE; // mirror-symmetric silhouette reused

// Muscle region overlays — positioned over the silhouette.
// Each is given id="m-<muscleId>" so it can be coloured via JS/CSS.

const FRONT_MUSCLES = `
<g class="muscle-group" fill="${COLOR_NEUTRAL}" stroke="#7d5a30" stroke-width="0.8" opacity="0.92">
  <path id="m-deep_neck_flexors"
        d="M 110 100
           Q 120 104 130 100
           L 130 112
           L 110 112 Z"/>
  <path id="m-pectorals"
        d="M 84 142
           C 80 168, 100 184, 116 184
           L 124 184
           C 140 184, 160 168, 156 142
           C 140 134, 122 134, 120 136
           C 118 134, 100 134, 84 142 Z"/>
  <path id="m-abdominals"
        d="M 98 196
           C 96 230, 96 264, 100 294
           C 104 312, 108 322, 116 326
           L 124 326
           C 132 322, 136 312, 140 294
           C 144 264, 144 230, 142 196
           C 134 200, 120 200, 120 200
           C 120 200, 106 200, 98 196 Z"/>
</g>
`;

const BACK_MUSCLES = `
<g class="muscle-group" fill="${COLOR_NEUTRAL}" stroke="#7d5a30" stroke-width="0.8" opacity="0.92">
  <path id="m-upper_traps"
        d="M 86 118
           C 96 138, 112 144, 118 144
           L 122 144
           C 128 144, 144 138, 154 118
           C 142 128, 120 128, 120 128
           C 120 128, 98 128, 86 118 Z"/>
  <path id="m-scapular_stabilizers"
        d="M 78 148
           C 72 178, 80 212, 92 224
           L 116 224
           L 116 162
           C 104 158, 92 154, 86 150
           C 82 148, 80 148, 78 148 Z
           M 162 148
           C 168 178, 160 212, 148 224
           L 124 224
           L 124 162
           C 136 158, 148 154, 154 150
           C 158 148, 160 148, 162 148 Z"/>
  <path id="m-erector_spinae"
        d="M 102 224
           C 100 270, 102 320, 108 330
           L 116 332
           L 116 224 Z
           M 138 224
           C 140 270, 138 320, 132 330
           L 124 332
           L 124 224 Z"/>
  <path id="m-glutes"
        d="M 72 350
           C 70 396, 90 416, 108 416
           C 118 416, 119 402, 119 388
           L 119 366
           C 100 354, 80 350, 72 350 Z
           M 168 350
           C 170 396, 150 416, 132 416
           C 122 416, 121 402, 121 388
           L 121 366
           C 140 354, 160 350, 168 350 Z"/>
  <path id="m-hamstrings"
        d="M 76 382
           C 74 416, 76 450, 84 470
           L 114 470
           C 116 432, 117 402, 114 382
           C 100 378, 84 378, 76 382 Z
           M 164 382
           C 166 416, 164 450, 156 470
           L 126 470
           C 124 432, 123 402, 126 382
           C 140 378, 156 378, 164 382 Z"/>
</g>
`;

const FRONT_LABEL = `<text x="120" y="20" text-anchor="middle" font-family="'Hiragino Sans','Yu Gothic UI',sans-serif" font-size="14" font-weight="700" fill="#3a2a18" letter-spacing="0.08em">前面</text>`;
const BACK_LABEL = `<text x="120" y="20" text-anchor="middle" font-family="'Hiragino Sans','Yu Gothic UI',sans-serif" font-size="14" font-weight="700" fill="#3a2a18" letter-spacing="0.08em">背面</text>`;

function frontSvg() {
  return `
<svg class="anatomy-svg" viewBox="0 0 240 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  ${FRONT_LABEL}
  ${FRONT_SILHOUETTE}
  ${FRONT_MUSCLES}
</svg>`;
}

function backSvg() {
  return `
<svg class="anatomy-svg" viewBox="0 0 240 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  ${BACK_LABEL}
  ${BACK_SILHOUETTE}
  ${BACK_MUSCLES}
</svg>`;
}

// Build the full anatomy panel HTML with front+back side by side and a legend.
// `weakIds` and `tightIds` are arrays of muscle IDs (matching `m-<id>` paths).
export function renderAnatomyPanel(weakIds = [], tightIds = []) {
  const weakSet = new Set(weakIds);
  const tightSet = new Set(tightIds);

  // Inline <style> scoped via a wrapper class — colours apply to <path id="m-..">.
  const styleRules = MUSCLES.map((m) => {
    if (weakSet.has(m.id)) {
      return `.anatomy-panel #m-${m.id} { fill: ${COLOR_WEAK}; stroke: #225a2e; }`;
    }
    if (tightSet.has(m.id)) {
      return `.anatomy-panel #m-${m.id} { fill: ${COLOR_TIGHT}; stroke: #8a4912; }`;
    }
    return ""; // leave neutral
  })
    .filter(Boolean)
    .join("\n");

  return `
<div class="anatomy-panel">
  <style>${styleRules}</style>
  <div class="anatomy-views">
    <div class="anatomy-view">${frontSvg()}</div>
    <div class="anatomy-view">${backSvg()}</div>
  </div>
  <div class="anatomy-legend">
    <span class="legend-item"><span class="legend-swatch swatch-weak"></span>鍛えるべき筋肉</span>
    <span class="legend-item"><span class="legend-swatch swatch-tight"></span>ほぐすべき筋肉</span>
  </div>
</div>
`;
}

export const ANATOMY_COLORS = { weak: COLOR_WEAK, tight: COLOR_TIGHT, neutral: COLOR_NEUTRAL };
