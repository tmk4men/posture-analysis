// 幾何計算（src/pose/angles.js）と所見文（src/pose/diagnosis.js）の自動テスト。
//
//   node --test 検証/
//
// fixtures/real-photos.json は実写2枚（素材/IMG_1814.jpg 正面・IMG_1815.jpg 右側面）を
// MediaPipe Pose heavy にかけて得た landmark をそのまま保存したもの。
// 検出器を呼ばずに、計測ロジックだけを回帰テストできる。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const { computeMetrics, checkCapture, LM } = await import("../src/pose/angles.js");
const { KNEE, WARN } = await import("../src/pose/thresholds.js");
const { buildDiagnosis } = await import("../src/pose/diagnosis.js");

const REAL = JSON.parse(
  readFileSync(join(HERE, "fixtures", "real-photos.json"), "utf8"),
);

const byKey = (metrics) => Object.fromEntries(metrics.map((m) => [m.key, m]));
const near = (actual, expected, tol, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: ${actual} が ${expected}±${tol} の外`,
  );

// ---- 合成 landmark ------------------------------------------------------
// 画素座標で人体を組み立ててから画像サイズで正規化する。
// こうするとテスト側は「何ピクセルずらしたか」で考えられ、
// 実装がアスペクト比を正しく戻しているかを検証できる。
function makeLandmarks(pointsPx, imageSize, defaults = {}) {
  const lms = Array.from({ length: 33 }, () => ({
    x: 0.5, y: 0.5, z: 0, visibility: 0.9, ...defaults,
  }));
  for (const [idx, p] of Object.entries(pointsPx)) {
    lms[idx] = {
      x: p.x / imageSize.width,
      y: p.y / imageSize.height,
      z: 0,
      visibility: p.v ?? 0.9,
    };
  }
  return lms;
}

// 正面：肩・骨盤・耳を水平に置いた理想姿勢。dy を足すと片側が下がる。
function frontalPose({ shoulderDy = 0, hipDy = 0, earDy = 0, shift = 0 } = {}) {
  // 画像上、患者の右（LM 12）は左側に写る。
  return {
    [LM.NOSE]: { x: 500, y: 200 },
    [LM.RIGHT_EAR]: { x: 440, y: 190 + earDy },
    [LM.LEFT_EAR]: { x: 560, y: 190 },
    [LM.RIGHT_SHOULDER]: { x: 350, y: 400 + shoulderDy },
    [LM.LEFT_SHOULDER]: { x: 650, y: 400 },
    [LM.RIGHT_HIP]: { x: 400 + shift, y: 1000 + hipDy },
    [LM.LEFT_HIP]: { x: 600 + shift, y: 1000 },
    [LM.RIGHT_KNEE]: { x: 400 + shift, y: 1400 },
    [LM.LEFT_KNEE]: { x: 600 + shift, y: 1400 },
    [LM.RIGHT_ANKLE]: { x: 400 + shift, y: 1800 },
    [LM.LEFT_ANKLE]: { x: 600 + shift, y: 1800 },
  };
}

// 側面：+x 方向を向いて立つ。headFwd/shoulderFwd は画素単位の前方変位。
// faceSign=-1 で左右反転（＝左側面として撮った写真）にする。
function sagittalPose({
  headFwd = 0, shoulderFwd = 0, kneeX = 0, faceSign = 1, vis = 0.9,
} = {}) {
  const f = (x) => 500 + faceSign * x;
  return {
    [LM.NOSE]: { x: f(120), y: 230 },
    [LM.LEFT_EAR]: { x: f(headFwd), y: 200 },
    [LM.RIGHT_EAR]: { x: f(headFwd), y: 200 },
    [LM.LEFT_SHOULDER]: { x: f(shoulderFwd), y: 400 },
    [LM.RIGHT_SHOULDER]: { x: f(shoulderFwd), y: 400 },
    [LM.LEFT_HIP]: { x: f(0), y: 1000, v: vis },
    [LM.RIGHT_HIP]: { x: f(0), y: 1000, v: vis },
    [LM.LEFT_KNEE]: { x: f(kneeX), y: 1400, v: vis },
    [LM.RIGHT_KNEE]: { x: f(kneeX), y: 1400, v: vis },
    [LM.LEFT_ANKLE]: { x: f(0), y: 1800, v: vis },
    [LM.RIGHT_ANKLE]: { x: f(0), y: 1800, v: vis },
  };
}

const SQUARE = { width: 1000, height: 1000 };
const PHONE = { width: 1000, height: 2000 };

// ---- 1. アスペクト比 ----------------------------------------------------

test("画像のアスペクト比が変わっても同じ姿勢は同じ値になる", () => {
  const posePx = frontalPose({ shoulderDy: 30, hipDy: -20 });
  const a = byKey(computeMetrics(makeLandmarks(posePx, SQUARE), "front", SQUARE));
  const b = byKey(computeMetrics(makeLandmarks(posePx, PHONE), "front", PHONE));
  for (const key of ["shoulder_tilt", "pelvic_tilt", "head_tilt", "lateral_shift"]) {
    near(b[key].value, a[key].value, 0.05, `front ${key}`);
  }

  const sidePx = sagittalPose({ headFwd: 90, shoulderFwd: -40 });
  const c = byKey(computeMetrics(makeLandmarks(sidePx, SQUARE), "right", SQUARE));
  const d = byKey(computeMetrics(makeLandmarks(sidePx, PHONE), "right", PHONE));
  for (const key of ["forward_head", "shoulder_forward", "trunk_lean", "knee_angle"]) {
    near(d[key].value, c[key].value, 0.05, `right ${key}`);
  }
});

test("角度は既知の値と一致する（肩を水平から30px/300px＝5.71°下げる）", () => {
  const m = byKey(
    computeMetrics(makeLandmarks(frontalPose({ shoulderDy: 30 }), PHONE), "front", PHONE),
  );
  // atan(30 / 300) = 5.71°、患者の右が下がるので正。
  near(m.shoulder_tilt.value, 5.7, 0.1, "shoulder_tilt");
});

// ---- 2. ±180° 折り返し --------------------------------------------------

test("肩・骨盤・頭部の傾きは常に -90〜90 に収まる", () => {
  for (const view of ["front", "back"]) {
    for (const dy of [-400, -30, 0, 30, 400]) {
      const m = byKey(
        computeMetrics(makeLandmarks(frontalPose({ shoulderDy: dy, hipDy: dy, earDy: dy }), PHONE), view, PHONE),
      );
      for (const key of ["shoulder_tilt", "pelvic_tilt", "head_tilt"]) {
        assert.ok(Math.abs(m[key].value) <= 90, `${view} ${key} = ${m[key].value}`);
      }
    }
  }
});

test("符号：患者の右が下がると正、左が下がると負", () => {
  const right = byKey(computeMetrics(makeLandmarks(frontalPose({ shoulderDy: 40, hipDy: 40, earDy: 40 }), PHONE), "front", PHONE));
  assert.ok(right.shoulder_tilt.value > 0 && right.shoulder_tilt.hint === "右肩が下がり");
  assert.ok(right.pelvic_tilt.value > 0 && right.pelvic_tilt.hint === "右骨盤が下がり");
  assert.ok(right.head_tilt.value > 0 && right.head_tilt.hint === "右側へ傾斜");

  const left = byKey(computeMetrics(makeLandmarks(frontalPose({ shoulderDy: -40, hipDy: -40, earDy: -40 }), PHONE), "front", PHONE));
  assert.ok(left.shoulder_tilt.value < 0 && left.shoulder_tilt.hint === "左肩が下がり");
  assert.ok(left.pelvic_tilt.value < 0 && left.pelvic_tilt.hint === "左骨盤が下がり");
  assert.ok(left.head_tilt.value < 0 && left.head_tilt.hint === "左側へ傾斜");
});

test("背面ビューでも患者の右が下がれば正のまま", () => {
  const pose = frontalPose({ shoulderDy: 40 });
  const front = byKey(computeMetrics(makeLandmarks(pose, PHONE), "front", PHONE));
  const back = byKey(computeMetrics(makeLandmarks(pose, PHONE), "back", PHONE));
  near(back.shoulder_tilt.value, front.shoulder_tilt.value, 0.01, "back shoulder_tilt");
});

test("左右シフトは正面と背面で同じ側を指す", () => {
  // 骨盤を患者の右（画像では左）へ寄せる ＝ 上半身は相対的に患者の左へ。
  const front = byKey(computeMetrics(makeLandmarks(frontalPose({ shift: -60 }), PHONE), "front", PHONE));
  assert.ok(front.lateral_shift.value < 0, `front ${front.lateral_shift.value}`);
  // 背面写真では同じ人が左右反転して写るので、landmark の x も反転させる。
  const mirrored = Object.fromEntries(
    Object.entries(frontalPose({ shift: -60 })).map(([k, p]) => [k, { ...p, x: 1000 - p.x }]),
  );
  const back = byKey(computeMetrics(makeLandmarks(mirrored, PHONE), "back", PHONE));
  assert.ok(back.lateral_shift.value < 0, `back ${back.lateral_shift.value}`);
  near(back.lateral_shift.value, front.lateral_shift.value, 0.05, "lateral_shift front/back");
});

// ---- 3. 側面：向きの自動判定 --------------------------------------------

test("左を向いた写真でも頭部前方位の符号は反転しない", () => {
  const r = byKey(computeMetrics(makeLandmarks(sagittalPose({ headFwd: 90, shoulderFwd: 40, faceSign: 1 }), PHONE), "right", PHONE));
  const l = byKey(computeMetrics(makeLandmarks(sagittalPose({ headFwd: 90, shoulderFwd: 40, faceSign: -1 }), PHONE), "left", PHONE));
  near(l.forward_head.value, r.forward_head.value, 0.05, "forward_head 左右反転");
  near(l.shoulder_forward.value, r.shoulder_forward.value, 0.05, "shoulder_forward 左右反転");
  assert.ok(r.forward_head.value > 0, "前方に出た頭は正");
});

test("左側面の写真を『右側面』の枠に入れても符号は写真から決まる", () => {
  const px = sagittalPose({ headFwd: 90, faceSign: -1 });
  const mislabeled = byKey(computeMetrics(makeLandmarks(px, PHONE), "right", PHONE));
  assert.ok(mislabeled.forward_head.value > 0, `${mislabeled.forward_head.value}`);
});

// ---- 4. 膝 --------------------------------------------------------------

test("まっすぐ立った脚は過伸展にならない", () => {
  const m = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: 0 }), PHONE), "right", PHONE));
  near(m.knee_angle.value, 180, 0.1, "knee_angle");
  assert.equal(m.knee_angle.severity, "ok");
  assert.equal(m.knee_angle.hint, "正常範囲");
});

test("膝が後方へ反ると過伸展、前へ曲がると屈曲位", () => {
  const hyper = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: -30 }), PHONE), "right", PHONE));
  assert.ok(hyper.knee_angle.value >= KNEE.hyper, `${hyper.knee_angle.value}`);
  assert.equal(hyper.knee_angle.severity, "warn");
  assert.equal(hyper.knee_angle.hint, "過伸展傾向");

  const flex = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: 60 }), PHONE), "right", PHONE));
  assert.ok(flex.knee_angle.value < KNEE.flex, `${flex.knee_angle.value}`);
  assert.equal(flex.knee_angle.severity, "warn");
  assert.equal(flex.knee_angle.hint, "屈曲位");
});

test("過伸展の判定は被写体の向きに依存しない", () => {
  const r = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: -30, faceSign: 1 }), PHONE), "right", PHONE));
  const l = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: -30, faceSign: -1 }), PHONE), "left", PHONE));
  assert.ok(r.knee_angle.value > 180, `right ${r.knee_angle.value}`);
  near(l.knee_angle.value, r.knee_angle.value, 0.05, "knee_angle 左右反転");
  // 曲がった膝は左右どちらを向いていても 180 未満。
  const rf = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: 30, faceSign: 1 }), PHONE), "right", PHONE));
  const lf = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX: 30, faceSign: -1 }), PHONE), "left", PHONE));
  assert.ok(rf.knee_angle.value < 180 && lf.knee_angle.value < 180);
});

test("hint と severity は必ず一致する（境界の取りこぼしがない）", () => {
  for (let kneeX = -60; kneeX <= 120; kneeX += 5) {
    const m = byKey(computeMetrics(makeLandmarks(sagittalPose({ kneeX }), PHONE), "right", PHONE));
    const warn = m.knee_angle.severity === "warn";
    const hinted = m.knee_angle.hint !== "正常範囲";
    assert.equal(warn, hinted, `kneeX=${kneeX} 角度=${m.knee_angle.value} hint=${m.knee_angle.hint}`);
  }
});

test("脚が写っていなければ膝は計測しない", () => {
  const m = byKey(computeMetrics(makeLandmarks(sagittalPose({ vis: 0.05 }), PHONE), "right", PHONE));
  assert.equal(m.knee_angle, undefined);
  const notes = checkCapture(makeLandmarks(sagittalPose({ vis: 0.05 }), PHONE), "right", PHONE);
  assert.ok(notes.some((n) => n.message.includes("膝の角度")));
});

// ---- 5. 撮影チェック ----------------------------------------------------

test("側面写真を正面の枠に入れたら弾く（逆も同じ）", () => {
  const side = makeLandmarks(sagittalPose({ headFwd: 60 }), PHONE);
  const asFront = checkCapture(side, "front", PHONE);
  assert.ok(asFront.some((n) => n.level === "error"), JSON.stringify(asFront));

  const front = makeLandmarks(frontalPose(), PHONE);
  const asSide = checkCapture(front, "right", PHONE);
  assert.ok(asSide.some((n) => n.level === "error"), JSON.stringify(asSide));
});

test("正しい向きの写真では error を出さない", () => {
  assert.equal(checkCapture(makeLandmarks(frontalPose(), PHONE), "front", PHONE).filter((n) => n.level === "error").length, 0);
  assert.equal(checkCapture(makeLandmarks(sagittalPose({ headFwd: 60 }), PHONE), "right", PHONE).filter((n) => n.level === "error").length, 0);
});

test("顔が横を向いた正面写真では頭部の傾きを出さない", () => {
  const px = frontalPose();
  px[LM.LEFT_EAR] = { x: 505, y: 190 };
  px[LM.RIGHT_EAR] = { x: 495, y: 190 };
  const m = byKey(computeMetrics(makeLandmarks(px, PHONE), "front", PHONE));
  assert.equal(m.head_tilt, undefined);
  assert.ok(checkCapture(makeLandmarks(px, PHONE), "front", PHONE).some((n) => n.message.includes("頭部の傾き")));
});

// ---- 6. 実写の回帰 ------------------------------------------------------

test("実写・正面（IMG_1814）：目視と符号が一致する", () => {
  const f = REAL.front;
  const m = byKey(computeMetrics(f.landmarks, "front", f.imageSize));
  near(m.shoulder_tilt.value, 1.1, 0.3, "shoulder_tilt");   // 右肩がわずかに下がる
  near(m.pelvic_tilt.value, -4.2, 0.3, "pelvic_tilt");      // 左の骨盤が下がる
  near(m.head_tilt.value, -1.8, 0.3, "head_tilt");          // 頭は左へ
  near(m.lateral_shift.value, -8.3, 0.3, "lateral_shift");  // 上半身は左へ
  assert.equal(checkCapture(f.landmarks, "front", f.imageSize).filter((n) => n.level === "error").length, 0);
});

test("実写・右側面（IMG_1815）：頭部前方位を拾い、まっすぐな膝を過伸展にしない", () => {
  const r = REAL.right;
  const m = byKey(computeMetrics(r.landmarks, "right", r.imageSize));
  near(m.forward_head.value, 13.5, 0.4, "forward_head");
  assert.equal(m.forward_head.severity, "warn");
  near(m.shoulder_forward.value, -6.1, 0.4, "shoulder_forward");
  near(m.trunk_lean.value, -3.5, 0.3, "trunk_lean");
  near(m.knee_angle.value, 178.8, 0.4, "knee_angle");
  assert.equal(m.knee_angle.severity, "ok");
  // うつむいて撮っているので撮り直しの案内が出る。
  assert.ok(checkCapture(r.landmarks, "right", r.imageSize).some((n) => n.message.includes("うつむき")));
});

test("実写2枚の所見文は正面と側面の両方に触れる", () => {
  const byView = {
    front: computeMetrics(REAL.front.landmarks, "front", REAL.front.imageSize),
    right: computeMetrics(REAL.right.landmarks, "right", REAL.right.imageSize),
  };
  const text = buildDiagnosis(byView, ["shoulder"], 2);
  assert.ok(text.includes("骨盤"), text);
  assert.ok(text.includes("頭が肩より前"), text);
  assert.ok(text.includes("肩まわりのハリ"), text);
  assert.ok(text.includes("週2回"), text);
  assert.ok(!/[0-9]/.test(text.replace(/週2回/, "")), `数値が本文に出ている: ${text}`);
  // 決定的であること。
  assert.equal(text, buildDiagnosis(byView, ["shoulder"], 2));
});

// ---- 7. しきい値との連動 ------------------------------------------------

test("severity バッジは thresholds.js の WARN ちょうどで切り替わる", () => {
  // 肩を WARN ぴったりまで傾ける：dx=300px なので dy = 300*tan(WARN)
  const dyAt = (deg) => 300 * Math.tan((deg * Math.PI) / 180);
  const under = byKey(computeMetrics(makeLandmarks(frontalPose({ shoulderDy: dyAt(WARN.shoulder_tilt - 0.5) }), PHONE), "front", PHONE));
  const over = byKey(computeMetrics(makeLandmarks(frontalPose({ shoulderDy: dyAt(WARN.shoulder_tilt + 0.5) }), PHONE), "front", PHONE));
  assert.equal(under.shoulder_tilt.severity, "ok");
  assert.equal(over.shoulder_tilt.severity, "warn");
});
