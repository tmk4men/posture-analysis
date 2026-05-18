// Deterministic posture-issue → muscle/exercise selection.
// AI is used only for the diagnosis narrative; the picks here are reproducible
// from the measured metrics so that two different patients always get
// noticeably different reports.

const V = new URL(import.meta.url).search;
const [musclesMod, assetsMod] = await Promise.all([
  import("../data/muscles.js" + V),
  import("../data/exerciseAssets.js" + V),
]);
const { MUSCLE_BY_ID } = musclesMod;
const { EXERCISE_ASSETS } = assetsMod;

function getMetric(byView, view, key) {
  const arr = byView?.[view];
  if (!arr) return null;
  return arr.find((m) => m.key === key) ?? null;
}

function signed(v) {
  const r = Math.round(v * 10) / 10;
  return (r >= 0 ? "+" : "") + r.toFixed(1);
}

// Clinical "warn" thresholds per metric. severity is computed as deviation /
// threshold (so 1.0 = at the warn line, 2.0 = double).  We pick up issues from
// half the threshold onward — small deviations still produce a personalised
// pick, but with a low severity so they sort below stronger findings.
const WARN = {
  forward_head: 10,    // % of torso height
  shoulder_forward: 8, // % of torso height
  trunk_lean: 5,       // °
  shoulder_tilt: 2,    // °
  pelvic_tilt: 2,      // °
  head_tilt: 3,        // °
  lateral_shift: 5,    // % of shoulder width
  knee_hyper: 2,       // ° beyond 178
  knee_flex: 5,        // ° below 165
};
const ENTRY_RATIO = 0.5; // pick up issues from half the clinical threshold

// Each detected issue contributes weak/tight muscle ids with a severity score
// (= magnitude / clinical threshold) and a note tied to the actual measured value.
// Mappings expanded with the broader muscle catalogue so different patients
// surface different muscles even when the headline finding is similar.
function detectIssues(byView) {
  const issues = [];
  const sideView = byView?.right ? "right" : byView?.left ? "left" : null;

  if (sideView) {
    const fh = getMetric(byView, sideView, "forward_head");
    if (fh && Math.abs(fh.value) / WARN.forward_head >= ENTRY_RATIO) {
      const sev = Math.abs(fh.value) / WARN.forward_head;
      const tag = `頭部前方位 ${signed(fh.value)}%`;
      issues.push({
        severity: sev,
        weak: [["deep_neck_flexors", `${tag}：頸部前面の支持力を回復`]],
        tight: [["upper_traps", `${tag}：頭部支持で過緊張`]],
      });
    }

    const sf = getMetric(byView, sideView, "shoulder_forward");
    if (sf && Math.abs(sf.value) / WARN.shoulder_forward >= ENTRY_RATIO) {
      const sev = Math.abs(sf.value) / WARN.shoulder_forward;
      const tag = `肩の前方変位 ${signed(sf.value)}%`;
      issues.push({
        severity: sev,
        weak: [
          ["scapular_stabilizers", `${tag}：肩甲骨の安定性が低下`],
          ["posterior_deltoid", `${tag}：肩後方の引き戻し力が不足`],
        ],
        tight: [
          ["pectorals", `${tag}：巻き肩の主因`],
          ["anterior_deltoid", `${tag}：肩前面が固定化`],
          ["lats", `${tag}：肩を内旋させる方向に作用`],
        ],
      });
    }

    const tr = getMetric(byView, sideView, "trunk_lean");
    if (tr && Math.abs(tr.value) / WARN.trunk_lean >= ENTRY_RATIO) {
      const sev = Math.abs(tr.value) / WARN.trunk_lean;
      if (tr.value > 0) {
        const tag = `体幹前傾 ${signed(tr.value)}°`;
        issues.push({
          severity: sev,
          weak: [
            ["abdominals", `${tag}：体幹前面の支持不足`],
            ["glutes", `${tag}：股関節伸展の力が不足`],
          ],
          tight: [
            ["iliopsoas", `${tag}：股関節屈筋が骨盤を前傾`],
            ["erector_spinae", `${tag}：腰背部で代償`],
          ],
        });
      } else {
        const tag = `体幹後傾 ${signed(tr.value)}°`;
        issues.push({
          severity: sev,
          weak: [
            ["erector_spinae", `${tag}：背筋の伸展力が低下`],
            ["iliopsoas", `${tag}：股関節前面の支持が不足`],
          ],
          tight: [
            ["hamstrings", `${tag}：骨盤後傾を助長`],
            ["calves", `${tag}：足首制限が後傾を強化`],
          ],
        });
      }
    }

    const kn = getMetric(byView, sideView, "knee_angle");
    if (kn) {
      if (kn.value >= 178) {
        const sev = (kn.value - 178) / WARN.knee_hyper + 1; // ≥1 once hyperextended
        issues.push({
          severity: sev,
          weak: [
            ["hamstrings", `膝過伸展 ${kn.value.toFixed(1)}°：膝後面の制動不足`],
            ["quadriceps", `膝過伸展 ${kn.value.toFixed(1)}°：膝伸展位での偏荷重`],
          ],
          tight: [
            ["calves", `膝過伸展 ${kn.value.toFixed(1)}°：下腿後面の短縮`],
          ],
        });
      } else if (kn.value < 165) {
        const sev = (165 - kn.value) / WARN.knee_flex + 1;
        issues.push({
          severity: sev,
          weak: [
            ["quadriceps", `膝屈曲位 ${kn.value.toFixed(1)}°：膝伸展力が低下`],
          ],
          tight: [
            ["hamstrings", `膝屈曲位 ${kn.value.toFixed(1)}°：もも裏が短縮`],
            ["calves", `膝屈曲位 ${kn.value.toFixed(1)}°：下腿後面が短縮`],
          ],
        });
      }
    }
  }

  if (byView?.front && byView.front.length) {
    const st = getMetric(byView, "front", "shoulder_tilt");
    if (st && Math.abs(st.value) / WARN.shoulder_tilt >= ENTRY_RATIO) {
      const sev = Math.abs(st.value) / WARN.shoulder_tilt;
      const tag = `肩の傾き ${signed(st.value)}°`;
      const highSide = st.value > 0 ? "左" : "右";
      issues.push({
        severity: sev,
        weak: [
          ["scapular_stabilizers", `${tag}：肩甲骨周囲の左右差`],
          ["lats", `${tag}：${highSide}と対側で広背筋の左右差`],
        ],
        tight: [
          ["upper_traps", `${tag}：${highSide}側の上部僧帽筋に過負荷`],
        ],
      });
    }

    const pt = getMetric(byView, "front", "pelvic_tilt");
    if (pt && Math.abs(pt.value) / WARN.pelvic_tilt >= ENTRY_RATIO) {
      const sev = Math.abs(pt.value) / WARN.pelvic_tilt;
      const tag = `骨盤の傾き ${signed(pt.value)}°`;
      const highSide = pt.value > 0 ? "左" : "右";
      issues.push({
        severity: sev,
        weak: [
          ["gluteus_medius", `${tag}：${highSide}側中臀筋の支持力が低下`],
          ["obliques", `${tag}：体幹側面の安定性が不足`],
        ],
        tight: [
          ["erector_spinae", `${tag}：${highSide}側腰背部で代償`],
          ["adductors", `${tag}：${highSide}と対側の内転筋が緊張`],
        ],
      });
    }

    const ht = getMetric(byView, "front", "head_tilt");
    if (ht && Math.abs(ht.value) / WARN.head_tilt >= ENTRY_RATIO) {
      const sev = Math.abs(ht.value) / WARN.head_tilt;
      const tag = `頭部傾斜 ${signed(ht.value)}°`;
      const tiltSide = ht.value > 0 ? "右" : "左";
      issues.push({
        severity: sev,
        weak: [],
        tight: [["upper_traps", `${tag}：${tiltSide}側頸部の緊張`]],
      });
    }

    const ls = getMetric(byView, "front", "lateral_shift");
    if (ls && Math.abs(ls.value) / WARN.lateral_shift >= ENTRY_RATIO) {
      const sev = Math.abs(ls.value) / WARN.lateral_shift;
      const tag = `上半身シフト ${signed(ls.value)}%`;
      const shiftSide = ls.value > 0 ? "右" : "左";
      issues.push({
        severity: sev,
        weak: [
          ["obliques", `${tag}：体幹側面の中心保持力が不足（${shiftSide}寄り）`],
          ["gluteus_medius", `${tag}：骨盤の側方安定性が不足（${shiftSide}寄り）`],
          ["abdominals", `${tag}：体幹前面の支持が不足`],
        ],
        tight: [
          ["adductors", `${tag}：${shiftSide}側内転筋が短縮`],
        ],
      });
    }
  }

  return issues;
}

// 全 issue 候補を取り損ねた時の救済：すべての計測値の中で最も逸脱しているものを
// 1件だけ「軽度の傾向」として返す。これで全員同じ固定フォールバックを返すのを防ぐ。
function pickTopMetric(byView) {
  const candidates = [];
  const sideView = byView?.right ? "right" : byView?.left ? "left" : null;
  if (sideView) {
    const fh = getMetric(byView, sideView, "forward_head");
    if (fh) candidates.push({
      ratio: Math.abs(fh.value) / WARN.forward_head,
      build: () => ({
        severity: Math.abs(fh.value) / WARN.forward_head,
        weak: [["deep_neck_flexors", `頭部前方位 ${signed(fh.value)}%（軽度）：頸部前面を意識`]],
        tight: [["upper_traps", `頭部前方位 ${signed(fh.value)}%（軽度）：頸部後面の張りに注意`]],
      }),
    });
    const sf = getMetric(byView, sideView, "shoulder_forward");
    if (sf) candidates.push({
      ratio: Math.abs(sf.value) / WARN.shoulder_forward,
      build: () => ({
        severity: Math.abs(sf.value) / WARN.shoulder_forward,
        weak: [["scapular_stabilizers", `肩の前方変位 ${signed(sf.value)}%（軽度）：肩甲骨周囲の活性化を`]],
        tight: [["pectorals", `肩の前方変位 ${signed(sf.value)}%（軽度）：胸前面の張りに注意`]],
      }),
    });
    const tr = getMetric(byView, sideView, "trunk_lean");
    if (tr) candidates.push({
      ratio: Math.abs(tr.value) / WARN.trunk_lean,
      build: () => tr.value > 0 ? ({
        severity: Math.abs(tr.value) / WARN.trunk_lean,
        weak: [["abdominals", `体幹前傾 ${signed(tr.value)}°（軽度）：体幹前面の活性化`]],
        tight: [["erector_spinae", `体幹前傾 ${signed(tr.value)}°（軽度）：腰背部の張りに注意`]],
      }) : ({
        severity: Math.abs(tr.value) / WARN.trunk_lean,
        weak: [["erector_spinae", `体幹後傾 ${signed(tr.value)}°（軽度）：背筋の活性化`]],
        tight: [["hamstrings", `体幹後傾 ${signed(tr.value)}°（軽度）：もも裏の張りに注意`]],
      }),
    });
  }
  if (byView?.front && byView.front.length) {
    const st = getMetric(byView, "front", "shoulder_tilt");
    if (st) candidates.push({
      ratio: Math.abs(st.value) / WARN.shoulder_tilt,
      build: () => ({
        severity: Math.abs(st.value) / WARN.shoulder_tilt,
        weak: [["scapular_stabilizers", `肩の傾き ${signed(st.value)}°（軽度）：肩甲骨周囲の左右差`]],
        tight: [["upper_traps", `肩の傾き ${signed(st.value)}°（軽度）：${st.value > 0 ? "左" : "右"}側上部僧帽筋`]],
      }),
    });
    const pt = getMetric(byView, "front", "pelvic_tilt");
    if (pt) candidates.push({
      ratio: Math.abs(pt.value) / WARN.pelvic_tilt,
      build: () => ({
        severity: Math.abs(pt.value) / WARN.pelvic_tilt,
        weak: [["glutes", `骨盤の傾き ${signed(pt.value)}°（軽度）：${pt.value > 0 ? "左" : "右"}側骨盤の支持`]],
        tight: [],
      }),
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.ratio - a.ratio);
  return candidates[0].build();
}

// Reduce per-issue contributions to a single highest-severity entry per muscle.
function aggregate(issues, kind) {
  const out = new Map();
  for (const issue of issues) {
    for (const [id, note] of issue[kind]) {
      if (!MUSCLE_BY_ID[id]) continue;
      const prev = out.get(id);
      if (!prev || issue.severity > prev.severity) {
        out.set(id, { severity: issue.severity, note });
      }
    }
  }
  return out;
}

// Per-patient pseudo-randomization seeded by metric values so two patients
// with even slightly different posture get different exercise picks, but the
// same input always reproduces the same output.
function metricSeed(byView) {
  let h = 2166136261;
  for (const view of Object.values(byView ?? {})) {
    if (!view) continue;
    for (const m of view) {
      h = Math.imul(h ^ Math.round((m.value ?? 0) * 100), 16777619);
    }
  }
  return (h >>> 0) || 1;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// 1筋肉に対する候補アセットの「焦点度」スコア。
// 単一筋肉ターゲット (=specificityがhigh) を優先することで、
// 「abdominal」のようなマルチターゲット汎用アセットが先に選ばれ続けるのを防ぐ。
function assetSpecificity(asset, targetMuscleId, kind) {
  const list = kind === "strength" ? asset.strengthens : asset.stretches;
  // 該当筋肉が含まれていなければ無効
  if (!list.includes(targetMuscleId)) return 0;
  // ターゲット筋以外も含む数 → 少ないほど focused
  return 1 / list.length;
}

function pickFocused(candidates, targetId, kind, rng, allAssets) {
  // specificity でソート、同点は seed で
  const scored = candidates.map((id) => {
    const asset = allAssets.find((a) => a.id === id);
    return { id, score: asset ? assetSpecificity(asset, targetId, kind) : 0 };
  });
  scored.sort((a, b) => b.score - a.score);
  // 最高点のグループだけ取り出し、その中から rng で1つ
  const topScore = scored[0]?.score ?? 0;
  const topTier = scored.filter((s) => s.score === topScore);
  return pickOne(topTier.map((s) => s.id), rng);
}

// Build a training plan (target 4 cards, min 1). Steps:
//   1) For each WEAK muscle in severity order, pick the most focused strength asset.
//   2) For each TIGHT muscle in severity order, pick the most focused stretch asset.
//   3) Top up by re-iterating the higher-severity muscles for more variety on
//      whichever side (weak vs tight) has the strongest unfilled finding.
// No hardcoded generic fallback — if no clinical candidates remain we show fewer
// cards rather than padding with unrelated exercises.
function buildTrainingPlan(weakList, tightList, rng) {
  const strengthByMuscle = new Map();
  const stretchByMuscle = new Map();
  for (const asset of EXERCISE_ASSETS) {
    for (const id of asset.strengthens) {
      if (!strengthByMuscle.has(id)) strengthByMuscle.set(id, []);
      strengthByMuscle.get(id).push(asset.id);
    }
    for (const id of asset.stretches) {
      if (!stretchByMuscle.has(id)) stretchByMuscle.set(id, []);
      stretchByMuscle.get(id).push(asset.id);
    }
  }

  const used = new Set();
  const plan = [];

  const weakIds = weakList.map((m) => m.id);
  const tightIds = tightList.map((m) => m.id);
  const sevOf = new Map([
    ...weakList.map((m) => [`w:${m.id}`, m.severity ?? 0]),
    ...tightList.map((m) => [`t:${m.id}`, m.severity ?? 0]),
  ]);

  // Phase 1: 1 strength pick per weak muscle (severity-sorted), cap at 3 cards
  for (const muscleId of weakIds) {
    if (plan.length >= 3) break;
    const candidates = (strengthByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
    if (!candidates.length) continue;
    const pick = pickFocused(candidates, muscleId, "strength", rng, EXERCISE_ASSETS);
    used.add(pick);
    plan.push({ assetId: pick });
  }

  // Phase 2: 1 stretch pick per tight muscle (severity-sorted), cap at 4 cards
  for (const muscleId of tightIds) {
    if (plan.length >= 4) break;
    const candidates = (stretchByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
    if (!candidates.length) continue;
    const pick = pickFocused(candidates, muscleId, "stretch", rng, EXERCISE_ASSETS);
    used.add(pick);
    plan.push({ assetId: pick });
  }

  // Phase 3: top-up. Each round, pick from the SEVERITY-HIGHEST muscle that
  // still has unused candidates — alternating between weak and tight by which
  // unfilled finding is more pressing for THIS patient.
  while (plan.length < 4) {
    const options = [];
    for (const muscleId of weakIds) {
      const cands = (strengthByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
      if (cands.length) options.push({
        muscleId, kind: "strength", cands,
        severity: sevOf.get(`w:${muscleId}`) ?? 0,
      });
    }
    for (const muscleId of tightIds) {
      const cands = (stretchByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
      if (cands.length) options.push({
        muscleId, kind: "stretch", cands,
        severity: sevOf.get(`t:${muscleId}`) ?? 0,
      });
    }
    if (!options.length) break;
    options.sort((a, b) => b.severity - a.severity);
    const pick = pickFocused(options[0].cands, options[0].muscleId, options[0].kind, rng, EXERCISE_ASSETS);
    used.add(pick);
    plan.push({ assetId: pick });
  }

  return plan.slice(0, 4);
}

// Compact summary string of detected issues — passed to the AI so the diagnosis
// narrative stays coherent with the picked muscles, without letting the AI
// override the selections.
export function summarizeIssues(metricsByView) {
  const issues = detectIssues(metricsByView);
  if (!issues.length) return "顕著な逸脱は検出されず（典型的な現代姿勢パターンを想定）。";
  const tags = [];
  for (const issue of issues) {
    for (const [, note] of issue.weak) tags.push(note);
    for (const [, note] of issue.tight) tags.push(note);
  }
  return tags.join(" / ");
}

// 患者から申告された主訴部位（肩こり・腰痛・膝痛など）を、解剖学的に対応する
// 筋肉ハイライトに変換する。型分類は使わず、入力された部位ごとに該当筋肉を
// 個別に severity = 1.0（= 臨床閾値相当）で重ねる。これにより、姿勢計測値が
// 似た患者でも申告された不調部位の違いが人体図にそのまま現れる。
const PAIN_AREA_MAP = {
  neck: {
    label: "首こり・首の痛み",
    weak: [["deep_neck_flexors", "首の不調：頸部前面の支持力を回復"]],
    tight: [["upper_traps", "首の不調：頸部後面に過緊張"]],
  },
  shoulder: {
    label: "肩こり",
    weak: [
      ["scapular_stabilizers", "肩の不調：肩甲骨の安定性を取り戻す"],
      ["posterior_deltoid", "肩の不調：肩後方の引き戻し力が不足"],
    ],
    tight: [
      ["upper_traps", "肩の不調：僧帽筋上部・肩甲挙筋に過緊張"],
      ["pectorals", "肩の不調：胸前面の短縮で巻き肩を助長"],
    ],
  },
  midback: {
    label: "背中の張り",
    weak: [["scapular_stabilizers", "背中の張り：肩甲骨周囲の活性が不足"]],
    tight: [
      ["lats", "背中の張り：広背筋の短縮"],
      ["erector_spinae", "背中の張り：脊柱起立筋の過緊張"],
    ],
  },
  lowback: {
    label: "腰痛",
    weak: [
      ["abdominals", "腰痛：体幹前面の支持が不足"],
      ["glutes", "腰痛：股関節伸展の力が不足"],
    ],
    tight: [
      ["erector_spinae", "腰痛：腰背部の過緊張"],
      ["iliopsoas", "腰痛：股関節屈筋の短縮で骨盤前傾を助長"],
    ],
  },
  hip: {
    label: "股関節の違和感",
    weak: [
      ["glutes", "股関節の不調：大臀筋の支持力が不足"],
      ["gluteus_medius", "股関節の不調：中臀筋の側方安定性が不足"],
    ],
    tight: [
      ["iliopsoas", "股関節の不調：股関節屈筋の短縮"],
      ["adductors", "股関節の不調：内転筋の短縮"],
    ],
  },
  knee: {
    label: "膝の痛み",
    weak: [["quadriceps", "膝の不調：膝伸展・支持の力が不足"]],
    tight: [
      ["quadriceps", "膝の不調：大腿四頭筋の張りが膝関節に負担"],
      ["hamstrings", "膝の不調：もも裏の短縮が膝屈曲を助長"],
      ["calves", "膝の不調：下腿後面の短縮"],
    ],
  },
  calf: {
    label: "ふくらはぎの張り",
    weak: [],
    tight: [["calves", "ふくらはぎの張り：下腿三頭筋の短縮"]],
  },
  thigh_front: {
    label: "太もも前の張り",
    weak: [],
    tight: [["quadriceps", "太もも前の張り：大腿四頭筋の短縮"]],
  },
  thigh_back: {
    label: "太もも裏の張り",
    weak: [],
    tight: [["hamstrings", "太もも裏の張り：ハムストリングスの短縮"]],
  },
};

export const PAIN_AREA_OPTIONS = Object.entries(PAIN_AREA_MAP).map(([id, def]) => ({
  id,
  label: def.label,
}));

// 主訴部位 → issues 互換オブジェクト。severity は 1.0（臨床閾値相当）で固定。
// aggregate は muscle ごとに max severity を取るので、計測値由来の強い所見が
// 既にあればそちらが残り、無ければ pain area 由来の note でハイライトされる。
function painAreaIssues(painAreas) {
  if (!painAreas || !painAreas.length) return [];
  const out = [];
  for (const area of painAreas) {
    const def = PAIN_AREA_MAP[area];
    if (!def) continue;
    out.push({ severity: 1.0, weak: def.weak, tight: def.tight });
  }
  return out;
}

export function painAreaLabels(painAreas) {
  if (!painAreas || !painAreas.length) return [];
  return painAreas
    .map((id) => PAIN_AREA_MAP[id]?.label)
    .filter(Boolean);
}

export function deriveRecommendations(metricsByView, painAreas = []) {
  const issues = [
    ...detectIssues(metricsByView),
    ...painAreaIssues(painAreas),
  ];
  const weakAgg = aggregate(issues, "weak");
  const tightAgg = aggregate(issues, "tight");

  // 何も拾えなかった場合：最も deviation の大きい1指標を「弱い傾向」として採用。
  // 全員同じ固定セットを返さないために、その人の最大逸脱を起点に組む。
  if (weakAgg.size === 0 && tightAgg.size === 0) {
    const top = pickTopMetric(metricsByView);
    if (top) {
      for (const [id, note] of top.weak) weakAgg.set(id, { severity: top.severity, note });
      for (const [id, note] of top.tight) tightAgg.set(id, { severity: top.severity, note });
    } else {
      // 計測値も無い場合のみ最終フォールバック（理想姿勢扱い）
      weakAgg.set("deep_neck_flexors", { severity: 0.1, note: "全体的に大きな逸脱は見られませんでした" });
      tightAgg.set("upper_traps", { severity: 0.1, note: "全体的に大きな逸脱は見られませんでした" });
    }
  }

  const toList = (m) =>
    [...m.entries()]
      .sort((a, b) => b[1].severity - a[1].severity)
      .map(([id, v]) => ({ id, note: v.note, severity: v.severity }));

  const weakMuscles = toList(weakAgg);
  const tightMuscles = toList(tightAgg);

  const rng = makeRng(metricSeed(metricsByView));
  const trainingPlan = buildTrainingPlan(weakMuscles, tightMuscles, rng);

  // 表示用に severity を落とす（report.js は {id, note} だけ参照）
  const stripSeverity = (m) => ({ id: m.id, note: m.note });

  return {
    weakMuscles: weakMuscles.map(stripSeverity),
    tightMuscles: tightMuscles.map(stripSeverity),
    trainingPlan,
  };
}
