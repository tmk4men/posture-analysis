// UGOQ仕様「姿勢分析AIシステム設計」の実装。
//
// 出典：IMG_2008.jpg（① 姿勢分析マスター／② ラクレッチマスター／
// ③ 筋力トレーニングマスター／④ メニュー処方マスター／⑤ メニュー生成ロジック）。
// 仕様書のフロー STEP2〜STEP8 をそのまま関数にしている。
//
//   STEP2  上半身姿勢を判定（U1〜U4）      → classifyUpper()
//   STEP3  下半身姿勢を判定（L1〜L4）      → classifyLower()
//   STEP4  上半身・下半身の結果を組み合わせ → buildMenu()
//   STEP5  ラクレッチ3種目を自動選択        → buildMenu()
//   STEP6  筋トレ3種目を自動選択            → buildMenu()
//   STEP7  有酸素運動（任意）を追加         → CARDIO
//   STEP8  クールダウンを表示               → COOLDOWN
//
// しきい値は thresholds.js（単一の真実源）。計測値は angles.js が返すキーを使う。

import { WARN, getMetric } from "./thresholds.js?v=20260814-1548";

// 逸脱がこの倍率（＝臨床しきい値ちょうど）を超えたときだけ「崩れている」と判定する。
// 超えるものが1つも無ければ U1／L1（正常）。
const TYPE_ENTRY_RATIO = 1.0;

// ---- ① 姿勢分析マスター -------------------------------------------------

export const UPPER_TYPES = {
  U1: { id: "U1", name: "正常", criteria: "耳・肩・股関節が一直線", focus: "維持" },
  U2: { id: "U2", name: "猫背・巻き肩", criteria: "胸椎後弯・肩甲骨外転・肩内旋", focus: "胸椎・肩甲骨" },
  U3: { id: "U3", name: "前方頭位", criteria: "耳が肩より前・頭部前方偏位", focus: "頭部・肩甲帯" },
  // 仕様書①④とも姿勢名は「フラットバック（胸椎可動性低下）」と括弧つきで書かれている。
  U4: { id: "U4", name: "フラットバック（胸椎可動性低下）", criteria: "胸椎カーブ減少・胸椎可動性低下", focus: "胸椎・体幹" },
};

export const LOWER_TYPES = {
  L1: { id: "L1", name: "正常", criteria: "骨盤・膝・足部正常", focus: "維持" },
  L2: { id: "L2", name: "骨盤前傾（反り腰）", criteria: "骨盤前傾・腰椎前弯増加", focus: "骨盤・腹筋・臀筋" },
  L3: { id: "L3", name: "スウェイバック", criteria: "骨盤前方変位・体幹後方", focus: "骨盤位置・体幹" },
  // 仕様書では L4 が「下肢アライメント異常（O脚・X脚）」の1行だが、
  // ④ 処方マスターは O脚 と X脚 で種目が違うので、実装では下位区分を持つ。
  L4_O: { id: "L4", name: "下肢アライメント異常（O脚）", criteria: "膝アライメント異常", focus: "股関節・膝・足部" },
  L4_X: { id: "L4", name: "下肢アライメント異常（X脚）", criteria: "膝アライメント異常", focus: "股関節・膝・足部" },
};

// ---- ④ メニュー処方マスター ---------------------------------------------
//
// ここがアプリの正式マスターデータ（先方確定・2026-08-02）。
// ② は「主な適応姿勢」＝そのラクレッチが効きやすい姿勢の一覧であって処方表ではないので、
// ②と④が食い違うセルがあっても ④ を実装する。②に無い使い方は姿勢改善の補助という位置づけ：
//   ・フラットバック（U4）の HIP … 骨盤可動性・股関節伸展・骨盤前後傾の誘導が目的
//   ・骨盤前傾／O脚／X脚 の TWISTER … 胸椎回旋・骨盤回旋・体幹連動の改善が目的
//
// 値は EXERCISE_ASSETS の id。仕様書の種目名との対応：
//   CHEST=stretch_chest / SHOULDER=stretch_shoulder / TWISTER=stretch_twister /
//   HIP=stretch_hip / ADDUCTOR=stretch_adductor
//   ラットプルダウン=lat_pulldown / ローイング=seated_row / リアデルト=pec_fly_rear_delt /
//   バックエクステンション=back_extension_bench / ヒップスラスト=hip_thrust /
//   アブドミナル=abdominal / レッグプレス=seated_leg_press / レッグカール=seated_leg_curl /
//   レッグエクステンション=leg_extension / ヒップアブダクション=hip_abduction /
//   アダクター=adductor_machine / カーフレイズ=calf_raise
export const PRESCRIPTION = {
  U2: {
    stretch: ["stretch_chest", "stretch_shoulder", "stretch_twister"],
    strength: ["lat_pulldown", "seated_row", "pec_fly_rear_delt"],
  },
  U3: {
    stretch: ["stretch_chest", "stretch_shoulder", "stretch_twister"],
    strength: ["seated_row", "pec_fly_rear_delt", "lat_pulldown"],
  },
  U4: {
    stretch: ["stretch_twister", "stretch_hip", "stretch_chest"],
    strength: ["back_extension_bench", "seated_row", "hip_thrust"],
  },
  L2: {
    stretch: ["stretch_hip", "stretch_adductor", "stretch_twister"],
    strength: ["abdominal", "hip_thrust", "seated_leg_curl"],
  },
  L3: {
    stretch: ["stretch_hip", "stretch_twister", "stretch_adductor"],
    strength: ["seated_leg_press", "abdominal", "seated_row"],
  },
  L4_O: {
    stretch: ["stretch_adductor", "stretch_hip", "stretch_twister"],
    strength: ["hip_abduction", "seated_leg_press", "calf_raise"],
  },
  L4_X: {
    stretch: ["stretch_adductor", "stretch_hip", "stretch_twister"],
    strength: ["adductor_machine", "leg_extension", "calf_raise"],
    // 仕様書④の X脚 行だけ種目に注記がある：「レッグエクステンション（VMOを意識）」。
    notes: { leg_extension: "VMOを意識" },
  },
  // 仕様書④に「正常」の行は無いため、こちらで維持メニューを起こして先方に確認し、
  // 2026-08-02 にこの内容で採用の回答を得た（正常姿勢の目的は「改善」ではなく「維持」）。
  //   ラクレッチ：CHEST / HIP / TWISTER　筋トレ：ローイング / アブドミナル / ヒップスラスト
  MAINTENANCE: {
    stretch: ["stretch_chest", "stretch_hip", "stretch_twister"],
    strength: ["seated_row", "abdominal", "hip_thrust"],
  },
};

// ---- STEP7 有酸素運動（任意）／STEP8 クールダウン ------------------------
// 仕様書 ⑥「ユーザー画面イメージ」の文言をそのまま採用する。
export const WARMUP = { label: "ウォーミングアップ（5分）", detail: "軽い有酸素運動・動的ストレッチ" };
export const CARDIO = { label: "有酸素運動（任意）", detail: "ウォーキング15分 など" };
export const COOLDOWN = { label: "クールダウン（5分）", detail: "胸ストレッチ・深呼吸 など" };

// ---- STEP2 上半身姿勢の判定 ---------------------------------------------
//
// 使う計測値（側面写真）：
//   forward_head     … 耳が肩より前に出た量（体幹高比％）
//   shoulder_forward … 肩が骨盤より前に出た量（体幹高比％）
//
// U2 猫背・巻き肩：肩が前に出ている（＝肩甲骨外転・肩内旋の見え方）
// U3 前方頭位　　：耳が肩より前に出ている
// U4 フラットバック：胸郭が骨盤より後ろにあり、かつ頭部前方位が小さい
//
// ※ U4 の本来の判定項目「胸椎カーブ減少」は、骨格2点（肩・骨盤）からは
//    直接測れない。胸郭が後方に位置し頭部前方位を伴わない形を代理指標とする。
//    ここは実測データが増えたら見直す前提。
export function classifyUpper(metricsByView) {
  const side = metricsByView?.right ? "right" : metricsByView?.left ? "left" : null;
  if (!side) return { type: UPPER_TYPES.U1, ratio: 0, measured: false };

  const fh = getMetric(metricsByView, side, "forward_head")?.value;
  const sf = getMetric(metricsByView, side, "shoulder_forward")?.value;
  if (fh == null || sf == null) return { type: UPPER_TYPES.U1, ratio: 0, measured: false };

  const candidates = [];
  if (sf > 0) candidates.push({ type: UPPER_TYPES.U2, ratio: sf / WARN.shoulder_forward });
  if (fh > 0) candidates.push({ type: UPPER_TYPES.U3, ratio: fh / WARN.forward_head });
  if (sf < 0 && fh < WARN.forward_head) {
    candidates.push({ type: UPPER_TYPES.U4, ratio: -sf / WARN.shoulder_forward });
  }
  return pickType(candidates, UPPER_TYPES.U1);
}

// ---- STEP3 下半身姿勢の判定 ---------------------------------------------
//
// 使う計測値：
//   trunk_lean       … 体幹の前後傾（側面・度）
//   pelvis_shift     … 骨盤が足首より前に出た量（側面・体幹高比％）
//   shoulder_forward … 肩が骨盤より前に出た量（側面・体幹高比％）
//   knee_alignment   … 膝の内外反（正面・下肢長比％、＋＝O脚 / −＝X脚）
//
// L2 骨盤前傾（反り腰）：体幹が前傾している（骨盤前傾の代償として現れる形）
// L3 スウェイバック　　：骨盤が前方へ変位し、かつ体幹（肩）が後方にある
// L4 下肢アライメント異常：膝が内外どちらかに大きく外れている
//
// ※ L2 の本来の判定項目「骨盤前傾・腰椎前弯増加」は、MediaPipe が骨盤を
//    左右1点ずつしか返さないため直接は測れない（ASIS/PSIS が取れない）。
//    体幹前傾を代理指標にしている。ここも実測が増えたら見直す前提。
export function classifyLower(metricsByView) {
  const side = metricsByView?.right ? "right" : metricsByView?.left ? "left" : null;
  const candidates = [];

  if (side) {
    const trunk = getMetric(metricsByView, side, "trunk_lean")?.value;
    const pelvis = getMetric(metricsByView, side, "pelvis_shift")?.value;
    const sf = getMetric(metricsByView, side, "shoulder_forward")?.value;
    if (trunk != null && trunk > 0) {
      candidates.push({ type: LOWER_TYPES.L2, ratio: trunk / WARN.trunk_lean });
    }
    if (pelvis != null && pelvis > 0 && sf != null && sf < 0) {
      candidates.push({ type: LOWER_TYPES.L3, ratio: pelvis / WARN.pelvis_shift });
    }
  }

  const knee = getMetric(metricsByView, "front", "knee_alignment")?.value;
  if (knee != null && knee !== 0) {
    candidates.push({
      type: knee > 0 ? LOWER_TYPES.L4_O : LOWER_TYPES.L4_X,
      ratio: Math.abs(knee) / WARN.knee_alignment,
      key: knee > 0 ? "L4_O" : "L4_X",
    });
  }

  const measured = side !== null || knee != null;
  const picked = pickType(candidates, LOWER_TYPES.L1);
  return { ...picked, measured };
}

// 逸脱が最大の候補を採用する。しきい値を超えるものが無ければ正常。
function pickType(candidates, normalType) {
  const over = candidates.filter((c) => c.ratio >= TYPE_ENTRY_RATIO);
  if (!over.length) return { type: normalType, ratio: 0, measured: true };
  over.sort((a, b) => b.ratio - a.ratio);
  return { type: over[0].type, ratio: over[0].ratio, key: over[0].key, measured: true };
}

// 処方マスターの行を引く。L4 は O脚／X脚 で行が分かれる。
function prescriptionFor(result) {
  if (!result || result.type.focus === "維持") return null;
  const key = result.key ?? result.type.id;
  return PRESCRIPTION[key] ?? null;
}

// ---- STEP4〜6 メニューの組み立て ----------------------------------------
//
// 上半身・下半身それぞれに3種目の処方があるので、合計6種目から3種目ずつに絞る。
// 割り振りは「逸脱の大きい側を優先」：
//   ・崩れが強い側から2種目、もう一方から1種目
//   ・片方が正常なら、崩れている側の①②③をそのまま3種目
//   ・両方とも正常なら維持メニュー
// 重複した種目は、逸脱の大きい側の次の候補で埋める。

// 各種目が主にどこを鍛える／伸ばすか。下半身タイプから1種目だけ採るときに使う。
const REGION = {
  // ラクレッチ
  stretch_chest: "upper", stretch_shoulder: "upper", stretch_twister: "trunk",
  stretch_hip: "lower", stretch_adductor: "lower",
  // 筋トレ
  lat_pulldown: "upper", seated_row: "upper", pec_fly_rear_delt: "upper",
  back_extension_bench: "trunk", abdominal: "trunk",
  hip_thrust: "lower", seated_leg_press: "lower", seated_leg_curl: "lower",
  leg_extension: "lower", hip_abduction: "lower", adductor_machine: "lower",
  calf_raise: "lower",
};

// 下半身の処方から1種目だけ採るときは、下肢の種目を先に見る。
//
// 仕様書 ⑥ ユーザー画面イメージ（U2猫背＋L2反り腰）の筋トレが
// ラットプルダウン／ローイング／ヒップスラストになっているため。
// ④ の骨盤前傾の行は ①アブドミナル ②ヒップスラスト の順で、
// 単純に①から採ると⑥と食い違う。④の表は一切変えずに⑥へ揃えるための規則。
// アブドミナルは体幹の種目で、上半身側から採った2種目と役割が重なりやすい
// ——という意味でも筋が通る。実際に順番が変わるのは L2 の筋トレだけ。
function orderForSecondary(list, isLower) {
  if (!isLower) return list;
  const lower = list.filter((id) => REGION[id] === "lower");
  return [...lower, ...list.filter((id) => !lower.includes(id))];
}

function mergePicks(primaryList, secondaryList, primaryCount) {
  const out = [];
  const push = (id) => {
    if (out.length < 3 && !out.includes(id)) out.push(id);
  };
  for (const id of primaryList.slice(0, primaryCount)) push(id);
  for (const id of secondaryList) push(id);
  for (const id of primaryList) push(id); // 重複で埋まらなかった分を優先側で補う
  return out;
}

export function buildMenu(upper, lower) {
  const upperRx = prescriptionFor(upper);
  const lowerRx = prescriptionFor(lower);
  // 仕様書④の種目に付いた注記（現状は X脚 の「VMOを意識」だけ）を持ち回る。
  const notes = { ...(upperRx?.notes ?? {}), ...(lowerRx?.notes ?? {}) };

  if (!upperRx && !lowerRx) {
    const rx = PRESCRIPTION.MAINTENANCE;
    return { stretch: [...rx.stretch], strength: [...rx.strength], notes, balance: "maintenance" };
  }
  if (!upperRx) {
    return { stretch: [...lowerRx.stretch], strength: [...lowerRx.strength], notes, balance: "lower_only" };
  }
  if (!lowerRx) {
    return { stretch: [...upperRx.stretch], strength: [...upperRx.strength], notes, balance: "upper_only" };
  }

  const upperFirst = (upper.ratio ?? 0) >= (lower.ratio ?? 0);
  const primary = upperFirst ? upperRx : lowerRx;
  const secondary = upperFirst ? lowerRx : upperRx;
  // 副側が下半身の処方なら、下肢の種目から先に採る（仕様書 ⑥ に合わせる）。
  const secondaryIsLower = upperFirst;
  return {
    stretch: mergePicks(
      primary.stretch,
      orderForSecondary(secondary.stretch, secondaryIsLower),
      2,
    ),
    strength: mergePicks(
      primary.strength,
      orderForSecondary(secondary.strength, secondaryIsLower),
      2,
    ),
    notes,
    balance: upperFirst ? "upper_led" : "lower_led",
  };
}

// ---- 公開エントリ：STEP2〜STEP8 を一度に回す ----------------------------
export function analyzePosture(metricsByView) {
  const upper = classifyUpper(metricsByView);
  const lower = classifyLower(metricsByView);
  const menu = buildMenu(upper, lower);
  return {
    upper,
    lower,
    menu,
    warmup: WARMUP,
    cardio: CARDIO,
    cooldown: COOLDOWN,
  };
}
