// UGOQ仕様書（IMG_2008.jpg）との突き合わせテスト。
//
//   node --test 検証/ugoq-spec.test.mjs
//
// 仕様書の ①姿勢分析マスター / ③筋力トレーニングマスター / ④メニュー処方マスターを
// 「画像に書いてある文字」としてこのファイルに書き写し、実装がそこから
// ズレていないことを検査する。実装側の表を書き換えたらここが落ちる。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const { computeMetrics } = await import("../src/pose/angles.js");
const { ASSET_BY_ID } = await import("../src/data/exerciseAssets.js");
const {
  UPPER_TYPES, LOWER_TYPES, PRESCRIPTION,
  WARMUP, CARDIO, COOLDOWN,
  classifyUpper, classifyLower, buildMenu, analyzePosture,
} = await import("../src/pose/postureTypes.js");

const REAL = JSON.parse(readFileSync(join(HERE, "fixtures", "real-photos.json"), "utf8"));

// ---- 画像から書き写した仕様 ---------------------------------------------

// ① 姿勢分析マスター
const SPEC_UPPER = [
  ["U1", "正常", "耳・肩・股関節が一直線", "維持"],
  ["U2", "猫背・巻き肩", "胸椎後弯・肩甲骨外転・肩内旋", "胸椎・肩甲骨"],
  ["U3", "前方頭位", "耳が肩より前・頭部前方偏位", "頭部・肩甲帯"],
  ["U4", "フラットバック（胸椎可動性低下）", "胸椎カーブ減少・胸椎可動性低下", "胸椎・体幹"],
];
const SPEC_LOWER = [
  ["L1", "正常", "骨盤・膝・足部正常", "維持"],
  ["L2", "骨盤前傾（反り腰）", "骨盤前傾・腰椎前弯増加", "骨盤・腹筋・臀筋"],
  ["L3", "スウェイバック", "骨盤前方変位・体幹後方", "骨盤位置・体幹"],
  ["L4_O", "下肢アライメント異常（O脚）", "膝アライメント異常", "股関節・膝・足部"],
  ["L4_X", "下肢アライメント異常（X脚）", "膝アライメント異常", "股関節・膝・足部"],
];

// ③ 筋力トレーニングマスター（仕様書の種目名 → このアプリのアセットid）
const SPEC_STRENGTH_MASTER = {
  "ラットプルダウン": "lat_pulldown",
  "ローイング": "seated_row",
  "リアデルト": "pec_fly_rear_delt",
  "バックエクステンション": "back_extension_bench",
  "ヒップスラスト": "hip_thrust",
  "アブドミナル": "abdominal",
  "レッグプレス": "seated_leg_press",
  "レッグカール": "seated_leg_curl",
  "レッグエクステンション": "leg_extension",
  "ヒップアブダクション": "hip_abduction",
  "アダクター": "adductor_machine",
  "カーフレイズ": "calf_raise",
};
// ② ラクレッチマスター
const SPEC_STRETCH_MASTER = {
  CHEST: "stretch_chest",
  SHOULDER: "stretch_shoulder",
  TWISTER: "stretch_twister",
  HIP: "stretch_hip",
  ADDUCTOR: "stretch_adductor",
};

// ④ メニュー処方マスター（ラクレッチ3種目＋筋トレ3種目）
const SPEC_PRESCRIPTION = {
  U2: {
    row: "猫背・巻き肩",
    stretch: ["CHEST", "SHOULDER", "TWISTER"],
    strength: ["ラットプルダウン", "ローイング", "リアデルト"],
  },
  U3: {
    row: "前方頭位",
    stretch: ["CHEST", "SHOULDER", "TWISTER"],
    strength: ["ローイング", "リアデルト", "ラットプルダウン"],
  },
  U4: {
    row: "フラットバック（胸椎可動性低下）",
    stretch: ["TWISTER", "HIP", "CHEST"],
    strength: ["バックエクステンション", "ローイング", "ヒップスラスト"],
  },
  L2: {
    row: "骨盤前傾（反り腰）",
    stretch: ["HIP", "ADDUCTOR", "TWISTER"],
    strength: ["アブドミナル", "ヒップスラスト", "レッグカール"],
  },
  L3: {
    row: "スウェイバック",
    stretch: ["HIP", "TWISTER", "ADDUCTOR"],
    strength: ["レッグプレス", "アブドミナル", "ローイング"],
  },
  L4_O: {
    row: "O脚",
    stretch: ["ADDUCTOR", "HIP", "TWISTER"],
    strength: ["ヒップアブダクション", "レッグプレス", "カーフレイズ"],
  },
  L4_X: {
    row: "X脚",
    stretch: ["ADDUCTOR", "HIP", "TWISTER"],
    strength: ["アダクター", "レッグエクステンション", "カーフレイズ"],
  },
};

// ---- ① 姿勢分析マスター --------------------------------------------------

test("① 上半身マスターの姿勢名・判定項目・改善ポイントが仕様書どおり", () => {
  for (const [key, name, criteria, focus] of SPEC_UPPER) {
    const t = UPPER_TYPES[key];
    assert.ok(t, `${key} が実装に無い`);
    assert.equal(t.name, name);
    assert.equal(t.criteria, criteria);
    assert.equal(t.focus, focus);
  }
  assert.deepEqual(Object.keys(UPPER_TYPES), ["U1", "U2", "U3", "U4"]);
});

test("① 下半身マスターの姿勢名・判定項目・改善ポイントが仕様書どおり", () => {
  for (const [key, name, criteria, focus] of SPEC_LOWER) {
    const t = LOWER_TYPES[key];
    assert.ok(t, `${key} が実装に無い`);
    assert.equal(t.name, name);
    assert.equal(t.criteria, criteria);
    assert.equal(t.focus, focus);
  }
  // 仕様書の L4 は1行だが、④の処方が O脚／X脚 で分かれるので実装では2つ持つ。
  assert.equal(LOWER_TYPES.L4_O.id, "L4");
  assert.equal(LOWER_TYPES.L4_X.id, "L4");
});

// ---- ②③ マスターの種目がすべて実在する ---------------------------------

test("②③ 仕様書の全マシンがアセットとして存在する", () => {
  for (const [name, id] of Object.entries({ ...SPEC_STRETCH_MASTER, ...SPEC_STRENGTH_MASTER })) {
    assert.ok(ASSET_BY_ID[id], `${name} に対応するアセット ${id} が無い`);
  }
});

test("ラクレッチ5種はストレッチ、筋トレ12種は筋力として登録されている", () => {
  for (const id of Object.values(SPEC_STRETCH_MASTER)) {
    assert.equal(ASSET_BY_ID[id].category, "stretch", id);
  }
  for (const id of Object.values(SPEC_STRENGTH_MASTER)) {
    assert.equal(ASSET_BY_ID[id].category, "strength", id);
  }
});

test("画像素材が無いのはカーフレイズだけ（他は必ず写真つき）", () => {
  const missing = Object.entries(SPEC_STRENGTH_MASTER)
    .concat(Object.entries(SPEC_STRETCH_MASTER))
    .filter(([, id]) => !ASSET_BY_ID[id].image)
    .map(([name]) => name);
  assert.deepEqual(missing, ["カーフレイズ"]);
});

// ---- ④ メニュー処方マスター ---------------------------------------------

test("④ 処方マスターの7行が種目・順番まで仕様書と一致する", () => {
  for (const [key, spec] of Object.entries(SPEC_PRESCRIPTION)) {
    const impl = PRESCRIPTION[key];
    assert.ok(impl, `${spec.row} の行が実装に無い`);
    assert.deepEqual(
      impl.stretch,
      spec.stretch.map((n) => SPEC_STRETCH_MASTER[n]),
      `${spec.row} のラクレッチ`,
    );
    assert.deepEqual(
      impl.strength,
      spec.strength.map((n) => SPEC_STRENGTH_MASTER[n]),
      `${spec.row} の筋トレ`,
    );
  }
});

test("④ X脚のレッグエクステンションには「VMOを意識」の注記が付く", () => {
  assert.equal(PRESCRIPTION.L4_X.notes?.leg_extension, "VMOを意識");
  const menu = buildMenu(
    { type: UPPER_TYPES.U1, ratio: 0 },
    { type: LOWER_TYPES.L4_X, ratio: 2, key: "L4_X" },
  );
  assert.equal(menu.notes.leg_extension, "VMOを意識");
});

// ---- ⑤ STEP4〜8 ----------------------------------------------------------

test("STEP5・6：メニューは必ずラクレッチ3種目・筋トレ3種目（重複なし）", () => {
  const upperKeys = ["U1", "U2", "U3", "U4"];
  const lowerKeys = ["L1", "L2", "L3", "L4_O", "L4_X"];
  for (const u of upperKeys) {
    for (const l of lowerKeys) {
      const menu = buildMenu(
        { type: UPPER_TYPES[u], ratio: u === "U1" ? 0 : 1.5 },
        { type: LOWER_TYPES[l], ratio: l === "L1" ? 0 : 1.2, key: l.startsWith("L4") ? l : undefined },
      );
      const label = `${u}×${l}`;
      assert.equal(menu.stretch.length, 3, `${label} ラクレッチ`);
      assert.equal(menu.strength.length, 3, `${label} 筋トレ`);
      assert.equal(new Set(menu.stretch).size, 3, `${label} ラクレッチが重複`);
      assert.equal(new Set(menu.strength).size, 3, `${label} 筋トレが重複`);
      for (const id of [...menu.stretch, ...menu.strength]) {
        assert.ok(ASSET_BY_ID[id], `${label} に未知のアセット ${id}`);
      }
    }
  }
});

// ⑥ ユーザー画面イメージ：【上半身】猫背・巻き肩／【下半身】反り腰 のとき
//   ラクレッチ … CHEST・SHOULDER・HIP
//   筋力トレーニング … ラットプルダウン・ローイング・ヒップスラスト
test("⑥ 画面イメージの例（猫背・巻き肩 × 反り腰）がそのまま再現される", () => {
  const menu = buildMenu(
    { type: UPPER_TYPES.U2, ratio: 3.0 },
    { type: LOWER_TYPES.L2, ratio: 1.0 },
  );
  assert.deepEqual(menu.stretch, ["stretch_chest", "stretch_shoulder", "stretch_hip"]);
  assert.deepEqual(menu.strength, ["lat_pulldown", "seated_row", "hip_thrust"]);
});

test("STEP4：逸脱の大きい側から2種目、もう一方から1種目", () => {
  const upperLed = buildMenu(
    { type: UPPER_TYPES.U2, ratio: 3.0 },
    { type: LOWER_TYPES.L2, ratio: 1.0 },
  );
  assert.equal(upperLed.balance, "upper_led");

  const lowerLed = buildMenu(
    { type: UPPER_TYPES.U2, ratio: 1.0 },
    { type: LOWER_TYPES.L2, ratio: 3.0 },
  );
  assert.equal(lowerLed.balance, "lower_led");
  // 下半身が主側なら④の①②をそのまま使い、上半身から①を足す。
  assert.deepEqual(lowerLed.stretch, ["stretch_hip", "stretch_adductor", "stretch_chest"]);
  assert.deepEqual(lowerLed.strength, ["abdominal", "hip_thrust", "lat_pulldown"]);
});

test("下肢優先の並べ替えは④の表そのものを書き換えない", () => {
  // 主側として使うときは④の順番どおり（①アブドミナル → ②ヒップスラスト）。
  assert.deepEqual(PRESCRIPTION.L2.strength, ["abdominal", "hip_thrust", "seated_leg_curl"]);
  // 並べ替えが効くのは L2 を副側から1種目だけ採るときに限られる。
  for (const l of ["L3", "L4_O", "L4_X"]) {
    const menu = buildMenu(
      { type: UPPER_TYPES.U2, ratio: 3.0 },
      { type: LOWER_TYPES[l], ratio: 1.0, key: l },
    );
    assert.equal(menu.strength[2], PRESCRIPTION[l].strength[0], `${l} は①のまま`);
    assert.equal(menu.stretch[2], PRESCRIPTION[l].stretch[0], `${l} は①のまま`);
  }
});

test("STEP4：片側が正常ならもう片側の①②③をそのまま使う", () => {
  const onlyLower = buildMenu(
    { type: UPPER_TYPES.U1, ratio: 0 },
    { type: LOWER_TYPES.L3, ratio: 1.8 },
  );
  assert.equal(onlyLower.balance, "lower_only");
  assert.deepEqual(onlyLower.stretch, PRESCRIPTION.L3.stretch);
  assert.deepEqual(onlyLower.strength, PRESCRIPTION.L3.strength);

  const onlyUpper = buildMenu(
    { type: UPPER_TYPES.U4, ratio: 1.4 },
    { type: LOWER_TYPES.L1, ratio: 0 },
  );
  assert.equal(onlyUpper.balance, "upper_only");
  assert.deepEqual(onlyUpper.stretch, PRESCRIPTION.U4.stretch);
});

test("STEP4：上下とも正常なら維持メニュー（仕様書に行が無いための実装追加）", () => {
  const menu = buildMenu(
    { type: UPPER_TYPES.U1, ratio: 0 },
    { type: LOWER_TYPES.L1, ratio: 0 },
  );
  assert.equal(menu.balance, "maintenance");
  assert.deepEqual(menu.stretch, PRESCRIPTION.MAINTENANCE.stretch);
});

test("STEP1・7・8 の固定文言が仕様書 ⑥ どおり", () => {
  assert.equal(WARMUP.label, "ウォーミングアップ（5分）");
  assert.equal(WARMUP.detail, "軽い有酸素運動・動的ストレッチ");
  assert.equal(CARDIO.label, "有酸素運動（任意）");
  assert.equal(CARDIO.detail, "ウォーキング15分 など");
  assert.equal(COOLDOWN.label, "クールダウン（5分）");
  assert.equal(COOLDOWN.detail, "胸ストレッチ・深呼吸 など");
});

// ---- STEP2・3 判定ロジック ----------------------------------------------

const side = (over) => ({ right: Object.entries(over).map(([key, value]) => ({ key, value })) });
const both = (sideOver, frontOver) => ({
  ...side(sideOver),
  front: Object.entries(frontOver).map(([key, value]) => ({ key, value })),
});

test("STEP2：肩が前なら猫背・巻き肩、頭だけ前なら前方頭位", () => {
  assert.equal(classifyUpper(side({ forward_head: 2, shoulder_forward: 14 })).type, UPPER_TYPES.U2);
  assert.equal(classifyUpper(side({ forward_head: 16, shoulder_forward: -2 })).type, UPPER_TYPES.U3);
  // 両方超えたら逸脱の大きい方（肩 20/8=2.5 > 頭 12/10=1.2）
  assert.equal(classifyUpper(side({ forward_head: 12, shoulder_forward: 20 })).type, UPPER_TYPES.U2);
  // 胸郭が後方かつ頭部前方位が小さい＝フラットバック
  assert.equal(classifyUpper(side({ forward_head: 3, shoulder_forward: -12 })).type, UPPER_TYPES.U4);
  // どれもしきい値未満なら正常
  assert.equal(classifyUpper(side({ forward_head: 5, shoulder_forward: 3 })).type, UPPER_TYPES.U1);
});

test("STEP3：骨盤前方＋体幹後方はスウェイバック、体幹前傾は骨盤前傾", () => {
  assert.equal(
    classifyLower(side({ trunk_lean: -2, pelvis_shift: 18, shoulder_forward: -6 })).type,
    LOWER_TYPES.L3,
  );
  assert.equal(
    classifyLower(side({ trunk_lean: 9, pelvis_shift: 1, shoulder_forward: 2 })).type,
    LOWER_TYPES.L2,
  );
  // 骨盤が前でも肩が前（体幹が後方でない）ならスウェイバックとしない
  assert.equal(
    classifyLower(side({ trunk_lean: -1, pelvis_shift: 18, shoulder_forward: 4 })).type,
    LOWER_TYPES.L1,
  );
});

test("STEP3：膝の内外反から O脚・X脚 を分ける", () => {
  assert.equal(
    classifyLower(both({ trunk_lean: 0, pelvis_shift: 0, shoulder_forward: 0 }, { knee_alignment: 9 })).type,
    LOWER_TYPES.L4_O,
  );
  assert.equal(
    classifyLower(both({ trunk_lean: 0, pelvis_shift: 0, shoulder_forward: 0 }, { knee_alignment: -9 })).type,
    LOWER_TYPES.L4_X,
  );
  // 軽度（しきい値未満）は L4 にしない
  assert.equal(
    classifyLower(both({ trunk_lean: 0, pelvis_shift: 0, shoulder_forward: 0 }, { knee_alignment: 2.7 })).type,
    LOWER_TYPES.L1,
  );
});

// ---- 実写での通し ---------------------------------------------------------

test("実写2枚：前方頭位 × スウェイバックと判定され、メニューが仕様どおり組まれる", () => {
  const byView = {
    front: computeMetrics(REAL.front.landmarks, "front", REAL.front.imageSize),
    right: computeMetrics(REAL.right.landmarks, "right", REAL.right.imageSize),
  };
  const posture = analyzePosture(byView);
  assert.equal(posture.upper.type, UPPER_TYPES.U3, "上半身");
  assert.equal(posture.lower.type, LOWER_TYPES.L3, "下半身");
  // 下半身の逸脱の方が大きい → L3 から2種目 ＋ U3 から1種目
  assert.equal(posture.menu.balance, "lower_led");
  assert.deepEqual(posture.menu.stretch, ["stretch_hip", "stretch_twister", "stretch_chest"]);
  assert.deepEqual(posture.menu.strength, ["seated_leg_press", "abdominal", "seated_row"]);
  // 同じ入力なら必ず同じメニュー
  assert.deepEqual(analyzePosture(byView).menu, posture.menu);
});
