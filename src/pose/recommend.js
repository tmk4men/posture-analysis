// Deterministic posture-issue → muscle/exercise selection.
// AI is used only for the diagnosis narrative; the picks here are reproducible
// from the measured metrics so that two different patients always get
// noticeably different reports.

const V = new URL(import.meta.url).search;
const [musclesMod, assetsMod, postureTypesMod] = await Promise.all([
  import("../data/muscles.js" + V),
  import("../data/exerciseAssets.js" + V),
  import("../data/postureTypes.js" + V),
]);
const { MUSCLE_BY_ID } = musclesMod;
const { EXERCISE_ASSETS } = assetsMod;
const { POSTURE_TYPE_BY_ID } = postureTypesMod;

function getMetric(byView, view, key) {
  const arr = byView?.[view];
  if (!arr) return null;
  return arr.find((m) => m.key === key) ?? null;
}

function signed(v) {
  const r = Math.round(v * 10) / 10;
  return (r >= 0 ? "+" : "") + r.toFixed(1);
}

// Each detected issue contributes weak/tight muscle ids with a severity score
// (2 = moderate, 3 = severe) and a note tied to the actual measured value.
function detectIssues(byView) {
  const issues = [];
  const sideView = byView?.right ? "right" : byView?.left ? "left" : null;

  if (sideView) {
    const fh = getMetric(byView, sideView, "forward_head");
    if (fh && fh.value >= 10) {
      const sev = fh.value >= 15 ? 3 : 2;
      const tag = `頭部前方位 ${signed(fh.value)}%`;
      issues.push({
        severity: sev,
        weak: [["deep_neck_flexors", `${tag}：頸部前面の支持力を回復`]],
        tight: [["upper_traps", `${tag}：頭部支持で過緊張`]],
      });
    }

    const sf = getMetric(byView, sideView, "shoulder_forward");
    if (sf && sf.value >= 8) {
      const sev = sf.value >= 12 ? 3 : 2;
      const tag = `肩の前方変位 ${signed(sf.value)}%`;
      issues.push({
        severity: sev,
        weak: [["scapular_stabilizers", `${tag}：肩甲骨の安定性が低下`]],
        tight: [["pectorals", `${tag}：巻き肩の主因`]],
      });
    }

    const tr = getMetric(byView, sideView, "trunk_lean");
    if (tr && Math.abs(tr.value) >= 5) {
      const sev = Math.abs(tr.value) >= 10 ? 3 : 2;
      if (tr.value > 0) {
        const tag = `体幹前傾 ${signed(tr.value)}°`;
        issues.push({
          severity: sev,
          weak: [["abdominals", `${tag}：体幹前面の支持不足`]],
          tight: [["erector_spinae", `${tag}：腰背部が代償`]],
        });
      } else {
        const tag = `体幹後傾 ${signed(tr.value)}°`;
        issues.push({
          severity: sev,
          weak: [["erector_spinae", `${tag}：背筋の伸展力が低下`]],
          tight: [["hamstrings", `${tag}：骨盤後傾を助長`]],
        });
      }
    }

    const kn = getMetric(byView, sideView, "knee_angle");
    if (kn) {
      if (kn.value >= 178) {
        issues.push({
          severity: 2,
          weak: [["hamstrings", `膝過伸展 ${kn.value.toFixed(1)}°：膝後面の制動不足`]],
          tight: [],
        });
      } else if (kn.value < 165) {
        issues.push({
          severity: 2,
          weak: [],
          tight: [["hamstrings", `膝屈曲位 ${kn.value.toFixed(1)}°：もも裏が短縮`]],
        });
      }
    }
  }

  if (byView?.front && byView.front.length) {
    const st = getMetric(byView, "front", "shoulder_tilt");
    if (st && Math.abs(st.value) >= 2) {
      const sev = Math.abs(st.value) >= 4 ? 3 : 2;
      const tag = `肩の傾き ${signed(st.value)}°`;
      const highSide = st.value > 0 ? "左" : "右";
      issues.push({
        severity: sev,
        weak: [["scapular_stabilizers", `${tag}：肩甲骨周囲の左右差`]],
        tight: [["upper_traps", `${tag}：${highSide}側の上部僧帽筋に過負荷`]],
      });
    }

    const pt = getMetric(byView, "front", "pelvic_tilt");
    if (pt && Math.abs(pt.value) >= 2) {
      const sev = Math.abs(pt.value) >= 4 ? 3 : 2;
      const tag = `骨盤の傾き ${signed(pt.value)}°`;
      issues.push({
        severity: sev,
        weak: [["glutes", `${tag}：骨盤の左右支持力が低下`]],
        tight: [["erector_spinae", `${tag}：腰背部で代償`]],
      });
    }

    const ht = getMetric(byView, "front", "head_tilt");
    if (ht && Math.abs(ht.value) >= 3) {
      const sev = Math.abs(ht.value) >= 5 ? 3 : 2;
      const tag = `頭部傾斜 ${signed(ht.value)}°`;
      issues.push({
        severity: sev,
        weak: [],
        tight: [["upper_traps", `${tag}：頸部一側の緊張`]],
      });
    }

    const ls = getMetric(byView, "front", "lateral_shift");
    if (ls && Math.abs(ls.value) >= 5) {
      const sev = Math.abs(ls.value) >= 10 ? 3 : 2;
      const tag = `上半身シフト ${signed(ls.value)}%`;
      issues.push({
        severity: sev,
        weak: [
          ["abdominals", `${tag}：体幹の中心保持力が不足`],
          ["glutes", `${tag}：骨盤の安定性が不足`],
        ],
        tight: [],
      });
    }
  }

  return issues;
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

// Build a 4-item training plan: prefer strength assets for weak muscles, then
// stretch assets for tight muscles, then top up with more strength from the
// remaining weak-muscle candidates.
function buildTrainingPlan(weakIds, tightIds, rng) {
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

  for (const muscleId of weakIds) {
    if (plan.length >= 3) break;
    const candidates = (strengthByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
    if (!candidates.length) continue;
    const pick = pickOne(candidates, rng);
    used.add(pick);
    plan.push({ assetId: pick });
  }

  for (const muscleId of tightIds) {
    if (plan.length >= 4) break;
    const candidates = (stretchByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
    if (!candidates.length) continue;
    const pick = pickOne(candidates, rng);
    used.add(pick);
    plan.push({ assetId: pick });
  }

  // Top up with extra strength picks (still tied to a weak muscle when possible).
  while (plan.length < 4) {
    let added = false;
    for (const muscleId of weakIds) {
      const candidates = (strengthByMuscle.get(muscleId) || []).filter((id) => !used.has(id));
      if (candidates.length) {
        const pick = pickOne(candidates, rng);
        used.add(pick);
        plan.push({ assetId: pick });
        added = true;
        break;
      }
    }
    if (added) continue;
    const FALLBACK = ["abdominal", "seated_row", "hip_thrust", "seated_chest_press"];
    const fb = FALLBACK.find((id) => !used.has(id));
    if (!fb) break;
    used.add(fb);
    plan.push({ assetId: fb });
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

// 計測値から姿勢7分類を判定する（IMG_0416 / IMG_0417 参照）。
// 完全な医学的鑑別ではなく、整骨院向けの傾向把握用ラベル。
export function classifyPostureType(metricsByView) {
  const sideView = metricsByView?.right ? "right" : metricsByView?.left ? "left" : null;
  const fh = sideView ? getMetric(metricsByView, sideView, "forward_head") : null;
  const sf = sideView ? getMetric(metricsByView, sideView, "shoulder_forward") : null;
  const tr = sideView ? getMetric(metricsByView, sideView, "trunk_lean") : null;
  const kn = sideView ? getMetric(metricsByView, sideView, "knee_angle") : null;

  const st = getMetric(metricsByView, "front", "shoulder_tilt");
  const pt = getMetric(metricsByView, "front", "pelvic_tilt");
  const ht = getMetric(metricsByView, "front", "head_tilt");
  const ls = getMetric(metricsByView, "front", "lateral_shift");

  const reasons = [];

  // 左右差判定（前面ビューが必要）
  const asymmetry =
    (st && Math.abs(st.value) >= 2) ||
    (pt && Math.abs(pt.value) >= 2) ||
    (ht && Math.abs(ht.value) >= 3) ||
    (ls && Math.abs(ls.value) >= 5);

  // 矢状面（横向き）所見
  const fhpHigh = fh && fh.value >= 10;
  const shoulderForwardHigh = sf && sf.value >= 8;
  const trunkForward = tr && tr.value >= 5; // 体幹前傾 → 反り腰寄りの代償
  const trunkBack = tr && tr.value <= -3; // 体幹後傾 → スウェイバック寄り
  const trunkFlat = tr && Math.abs(tr.value) < 2 && !fhpHigh && !shoulderForwardHigh;
  const kneeHyper = kn && kn.value >= 178;

  const sagittalFlags = [];
  if (fhpHigh) sagittalFlags.push("kyphosis_signal");
  if (shoulderForwardHigh) sagittalFlags.push("kyphosis_signal");
  if (trunkForward) sagittalFlags.push("lordosis_signal");
  if (trunkBack || kneeHyper) sagittalFlags.push("swayback_signal");
  if (trunkFlat) sagittalFlags.push("flatback_signal");

  const distinctSignals = new Set(sagittalFlags);

  // 複合タイプ：矢状面の異なる signal が2系統以上、または矢状面異常＋左右差
  if (
    distinctSignals.size >= 2 ||
    (asymmetry && distinctSignals.size >= 1)
  ) {
    if (fhpHigh || shoulderForwardHigh) reasons.push("猫背の傾向");
    if (trunkForward) reasons.push("反り腰の傾向");
    if (trunkBack || kneeHyper) reasons.push("スウェイバックの傾向");
    if (trunkFlat) reasons.push("フラットバックの傾向");
    if (asymmetry) reasons.push("左右差あり");
    return { id: "combined", reasons };
  }

  if (asymmetry) {
    if (st && Math.abs(st.value) >= 2) reasons.push(`肩の高さに差（${signed(st.value)}°）`);
    if (pt && Math.abs(pt.value) >= 2) reasons.push(`骨盤の高さに差（${signed(pt.value)}°）`);
    if (ht && Math.abs(ht.value) >= 3) reasons.push(`頭部傾斜（${signed(ht.value)}°）`);
    if (ls && Math.abs(ls.value) >= 5) reasons.push(`上半身の左右シフト（${signed(ls.value)}%）`);
    return { id: "asymmetry", reasons };
  }

  if (fhpHigh && shoulderForwardHigh) {
    reasons.push(`頭部前方位 ${signed(fh.value)}%`);
    reasons.push(`肩の前方変位 ${signed(sf.value)}%`);
    return { id: "kyphosis", reasons };
  }

  if (trunkBack || kneeHyper) {
    if (trunkBack) reasons.push(`体幹後傾 ${signed(tr.value)}°`);
    if (kneeHyper) reasons.push(`膝過伸展 ${kn.value.toFixed(1)}°`);
    return { id: "swayback", reasons };
  }

  if (trunkForward) {
    reasons.push(`体幹前傾 ${signed(tr.value)}°`);
    return { id: "lordosis", reasons };
  }

  if (fhpHigh) {
    reasons.push(`頭部前方位 ${signed(fh.value)}%`);
    return { id: "kyphosis", reasons };
  }

  if (trunkFlat) {
    reasons.push("脊柱のS字カーブが目立たない");
    return { id: "flatback", reasons };
  }

  return { id: "ideal", reasons: ["顕著な逸脱なし"] };
}

export function deriveRecommendations(metricsByView) {
  const issues = detectIssues(metricsByView);
  const weakAgg = aggregate(issues, "weak");
  const tightAgg = aggregate(issues, "tight");

  // Fallback when nothing exceeds thresholds: typical modern-posture profile.
  if (weakAgg.size === 0 && tightAgg.size === 0) {
    weakAgg.set("deep_neck_flexors", { severity: 1, note: "典型的な現代姿勢パターン" });
    weakAgg.set("scapular_stabilizers", { severity: 1, note: "典型的な現代姿勢パターン" });
    weakAgg.set("glutes", { severity: 1, note: "典型的な現代姿勢パターン" });
    tightAgg.set("upper_traps", { severity: 1, note: "典型的な現代姿勢パターン" });
    tightAgg.set("pectorals", { severity: 1, note: "典型的な現代姿勢パターン" });
  }

  const toList = (m) =>
    [...m.entries()]
      .sort((a, b) => b[1].severity - a[1].severity)
      .slice(0, 5)
      .map(([id, v]) => ({ id, note: v.note }));

  const weakMuscles = toList(weakAgg);
  const tightMuscles = toList(tightAgg);

  const rng = makeRng(metricSeed(metricsByView));
  const trainingPlan = buildTrainingPlan(
    weakMuscles.map((m) => m.id),
    tightMuscles.map((m) => m.id),
    rng,
  );

  const typeResult = classifyPostureType(metricsByView);
  const typeDef = POSTURE_TYPE_BY_ID[typeResult.id] || POSTURE_TYPE_BY_ID.ideal;
  const postureType = {
    id: typeResult.id,
    no: typeDef.no,
    label: typeDef.label,
    short: typeDef.short,
    description: typeDef.description,
    landmarks: typeDef.landmarks,
    reasons: typeResult.reasons,
  };

  return { weakMuscles, tightMuscles, trainingPlan, postureType };
}
