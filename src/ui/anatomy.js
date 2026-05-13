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

// SVG silhouette (front view).  240 wide × 600 tall viewBox.
const FRONT_SILHOUETTE = `
<g class="silhouette" fill="#f6e5cf" stroke="#9b7a52" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
  <!-- head -->
  <ellipse cx="120" cy="56" rx="28" ry="36"/>
  <!-- neck -->
  <path d="M108 86 Q108 100 105 112 L135 112 Q132 100 132 86 Q126 92 120 92 Q114 92 108 86 Z"/>
  <!-- torso + hips + legs as a single silhouette -->
  <path d="
    M105 112
    Q88 116 78 126
    Q62 142 58 170
    Q52 210 56 252
    Q60 290 70 320
    Q72 350 76 372
    Q70 400 72 440
    Q74 490 80 540
    Q84 580 88 595
    L114 595
    Q116 580 117 540
    Q118 490 119 440
    L120 405
    L121 440
    Q122 490 123 540
    Q124 580 126 595
    L152 595
    Q156 580 160 540
    Q166 490 168 440
    Q170 400 164 372
    Q168 350 170 320
    Q180 290 184 252
    Q188 210 182 170
    Q178 142 162 126
    Q152 116 135 112
    Z
  "/>
  <!-- arms (drawn behind silhouette via order — these come later visually) -->
  <path d="
    M78 126
    Q56 162 46 222
    Q42 300 46 360
    L62 360
    Q58 300 64 224
    Q70 174 84 138
    Z
  "/>
  <path d="
    M162 126
    Q184 162 194 222
    Q198 300 194 360
    L178 360
    Q182 300 176 224
    Q170 174 156 138
    Z
  "/>
</g>
`;

const BACK_SILHOUETTE = FRONT_SILHOUETTE; // mirror-symmetric silhouette, OK to reuse

// Muscle region overlays.  Each path is given id="m-<muscleId>" so it
// can be coloured by JS based on the AI's weak/tight classification.
// Numbers chosen to sit roughly on the right anatomical area.

const FRONT_MUSCLES = `
<g class="muscle-group" fill="${COLOR_NEUTRAL}" stroke="#7d5a30" stroke-width="0.8" opacity="0.92">
  <!-- 深層頸部屈筋群 (deep neck flexors) — small band on the throat -->
  <path id="m-deep_neck_flexors"
        d="M112 96 Q120 100 128 96 L128 110 L112 110 Z"/>
  <!-- 胸筋群 (pectorals) — two ovals on upper chest -->
  <path id="m-pectorals"
        d="M84 130
           Q82 158 110 170
           Q120 174 120 170
           Q120 174 130 170
           Q158 158 156 130
           Q140 120 120 122
           Q100 120 84 130 Z"/>
  <!-- 腹筋群 (abdominals) — vertical block on belly with 6-pack ridges -->
  <path id="m-abdominals"
        d="M96 178
           Q94 220 96 260
           Q98 290 104 308
           L120 314
           L136 308
           Q142 290 144 260
           Q146 220 144 178
           Q120 184 96 178 Z"/>
</g>
`;

const BACK_MUSCLES = `
<g class="muscle-group" fill="${COLOR_NEUTRAL}" stroke="#7d5a30" stroke-width="0.8" opacity="0.92">
  <!-- 肩甲挙筋・僧帽筋上部 (upper traps / levator scapulae) -->
  <path id="m-upper_traps"
        d="M92 116
           Q98 134 116 142
           L120 144
           L124 142
           Q142 134 148 116
           Q138 124 120 124
           Q102 124 92 116 Z"/>
  <!-- 肩甲骨周囲筋 (scapular stabilisers) — two trapezoid shapes -->
  <path id="m-scapular_stabilizers"
        d="M82 138
           Q78 174 92 210
           L116 210
           L116 152
           Q104 148 96 144
           Q90 142 82 138 Z
           M158 138
           Q162 174 148 210
           L124 210
           L124 152
           Q136 148 144 144
           Q150 142 158 138 Z"/>
  <!-- 腰背部筋群（脊柱起立筋） -->
  <path id="m-erector_spinae"
        d="M104 214
           Q102 260 104 310
           L116 320
           L116 214 Z
           M136 214
           Q138 260 136 310
           L124 320
           L124 214 Z"/>
  <!-- 臀筋群 (glutes) — two rounded shapes on the buttocks -->
  <path id="m-glutes"
        d="M76 360
           Q74 405 96 420
           Q118 422 118 400
           L118 370
           Q100 360 76 360 Z
           M164 360
           Q166 405 144 420
           Q122 422 122 400
           L122 370
           Q140 360 164 360 Z"/>
  <!-- ハムストリングス (hamstrings) — two long shapes on back of thighs -->
  <path id="m-hamstrings"
        d="M84 430
           Q80 490 86 540
           L112 540
           Q114 490 112 430
           Q98 426 84 430 Z
           M156 430
           Q160 490 154 540
           L128 540
           Q126 490 128 430
           Q142 426 156 430 Z"/>
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
