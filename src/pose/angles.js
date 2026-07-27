// 骨格点 → 計測値の純粋な幾何計算。
//
// severity（レポートの warn/ok バッジ）のカットオフは thresholds.js を参照する。
// 以前はここに同じ数値をベタ書きしていたため、thresholds.js を変えても
// バッジだけ古い値のまま取り残される状態だった（バッジは赤いのに所見文には
// 出てこない、等）。数値を増やすときは必ず thresholds.js 側に足すこと。
//
// ---- 座標系について（最重要） -------------------------------------------
// MediaPipe の landmark は x・y をそれぞれ独立に 0..1 へ正規化して返す。
// つまり元画像が正方形でない限り、x の 1.0 と y の 1.0 は違う長さを表す。
// この正規化座標のまま atan2 や距離計算をすると、スマホ写真（3:4 ≒ 縦1.5倍）で
// 角度も比率も 1.5 倍前後ずれる。実際、旧実装では
//   ・頭部前方位 28.6%（実測 13.5%）
//   ・肩の傾き −179.3°（実測 +1.1°、符号まで反対）
// といった値を出していた。
// そのため computeMetrics は必ず画像サイズを受け取り、
// 最初に画素空間へ戻してから幾何計算する。

const V = new URL(import.meta.url).search;
const { WARN, KNEE, VISIBILITY_FLOOR, CAPTURE } = await import("./thresholds.js" + V);

// MediaPipe Pose 33 landmark indices (subset we use)
export const LM = {
  NOSE: 0,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

const RAD = 180 / Math.PI;

// 正規化 landmark → 画素空間。以降の計算はすべてこの空間で行う。
function toPixels(landmarks, imageSize) {
  const w = Number(imageSize?.width) || 1;
  const h = Number(imageSize?.height) || 1;
  return landmarks.map((p) => ({
    x: p.x * w,
    y: p.y * h,
    v: p.visibility ?? 1,
  }));
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v ?? 1, b.v ?? 1) };
}

// 水平線からの傾き（度）。−90〜+90 に必ず収まる。
// 戻り値 > 0 ＝ b が a より画像の下にある（y は下向き）。
//
// 旧実装は atan2(dy, dx) をそのまま返していた。正面写真では患者の右肩（LM 12）が
// 画像の左に写るため dx が負になり、答えが ±180° 付近に折り返って
// 「1.1° の傾き」が「−179.3°」として出ていた。|dx| を使えば
// 左右どちらの順で渡しても、また正面・背面のどちらでも折り返しは起きない。
function tiltFromHorizontal(a, b) {
  return Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * RAD;
}

// 膝角度（hip–knee–ankle）。180°＝まっすぐ、180未満＝屈曲、180超＝過伸展。
//
// innerAngle は 0〜180 しか返さないので、膝が前に曲がっても後ろへ反っても
// 同じ「180未満」になる。旧実装はこれをそのまま使い「≥178 なら過伸展」と
// 判定していたため、実際には〈わずかに曲がった膝〉を過伸展と呼び、
// 本物の反張膝は 180 を超えられないので永久に検出できなかった。
// 股関節→足首の線に対して膝が前後どちらにあるかで符号を付けて解決する。
function signedKneeAngle(hip, knee, ankle, facingSign) {
  const raw = innerAngle(hip, knee, ankle);
  const span = ankle.y - hip.y;
  // 股関節→足首の線上で、膝の高さにおける x。
  const t = span === 0 ? 0.5 : (knee.y - hip.y) / span;
  const lineX = hip.x + t * (ankle.x - hip.x);
  const anterior = (knee.x - lineX) * facingSign; // >0 ＝ 膝が前（＝屈曲側）
  return anterior >= 0 ? raw : 360 - raw;
}

// Inner angle ABC (degrees), 0–180.
function innerAngle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return Math.acos(cos) * RAD;
}

function classify(value, warnAbove) {
  return Math.abs(value) >= warnAbove ? "warn" : "ok";
}

// 側面写真で被写体がどちら（画像の +x / −x）を向いているかを、
// ビュー名ではなく画像そのものから決める。
// 鼻は必ず耳より顔の前側にあるので、その水平差の符号が向きになる。
// ビュー名だけを信じると、左側面の写真を「右側面」の枠に入れただけで
// 頭部前方位の符号が反転し、猫背が「頭が後方」と出てしまう。
function facingSignFromLandmarks(px, view) {
  const fallback = view === "left" ? -1 : 1;
  const nose = px[LM.NOSE];
  const earMid = midpoint(px[LM.LEFT_EAR], px[LM.RIGHT_EAR]);
  const dx = nose.x - earMid.x;
  const scale = Math.abs(px[LM.LEFT_HIP].y - px[LM.LEFT_SHOULDER].y) || 1;
  // 顔が真正面／真後ろだと鼻と耳中点がほぼ重なる。判別できないのでビュー名に従う。
  if (Math.abs(dx) < scale * 0.02) return fallback;
  return dx >= 0 ? 1 : -1;
}

// 正面から見た膝の内外反。脚ごとに、股関節→足首を結ぶ線に対して
// 膝がどれだけ「外側」へ外れているかを下肢長比％で測り、左右平均する。
// ＋＝膝が外側＝O脚（内反）傾向、−＝膝が内側＝X脚（外反）傾向。
// 左右の膝の間隔と足首の間隔を比べる方法もあるが、それだと立ち幅で値が変わる。
function kneeVarusPercent(px, midHip) {
  const legs = [
    { hip: px[LM.RIGHT_HIP], knee: px[LM.RIGHT_KNEE], ankle: px[LM.RIGHT_ANKLE] },
    { hip: px[LM.LEFT_HIP], knee: px[LM.LEFT_KNEE], ankle: px[LM.LEFT_ANKLE] },
  ];
  const values = [];
  for (const leg of legs) {
    if (Math.min(leg.knee.v ?? 0, leg.ankle.v ?? 0) < VISIBILITY_FLOOR) continue;
    const legLength = Math.abs(leg.ankle.y - leg.hip.y);
    if (legLength < 1) continue;
    const span = leg.ankle.y - leg.hip.y;
    const t = (leg.knee.y - leg.hip.y) / span;
    const lineX = leg.hip.x + t * (leg.ankle.x - leg.hip.x);
    // その脚にとっての「外側」＝骨盤中央から股関節へ向かう向き。
    const outward = Math.sign(leg.hip.x - midHip.x) || 1;
    values.push((((leg.knee.x - lineX) * outward) / legLength) * 100);
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// 膝角度に使う脚を visibility で選ぶ。側面では遠い側の脚がほぼ隠れており、
// そちらを使うと推定だけで置かれた点から角度を出すことになる。
function pickLeg(px) {
  const sides = [
    { side: "right", hip: px[LM.RIGHT_HIP], knee: px[LM.RIGHT_KNEE], ankle: px[LM.RIGHT_ANKLE] },
    { side: "left", hip: px[LM.LEFT_HIP], knee: px[LM.LEFT_KNEE], ankle: px[LM.LEFT_ANKLE] },
  ].map((s) => ({ ...s, conf: Math.min(s.knee.v ?? 0, s.ankle.v ?? 0) }));
  sides.sort((a, b) => b.conf - a.conf);
  return sides[0];
}

// Given normalized landmarks (0..1) and the source image size, return metrics per view.
// view: 'front' | 'back' | 'left' | 'right'
// imageSize: { width, height } — 省略時は正方形とみなす（角度が歪むので必ず渡すこと）。
export function computeMetrics(landmarks, view, imageSize) {
  if (!landmarks || landmarks.length < 33) return [];
  const px = toPixels(landmarks, imageSize);
  const metrics = [];

  if (view === "front" || view === "back") {
    const lSh = px[LM.LEFT_SHOULDER];
    const rSh = px[LM.RIGHT_SHOULDER];
    const lHip = px[LM.LEFT_HIP];
    const rHip = px[LM.RIGHT_HIP];
    const lEar = px[LM.LEFT_EAR];
    const rEar = px[LM.RIGHT_EAR];

    // 患者の左肩 → 右肩 の順で渡すので、正 ＝ 右肩が下がり。
    // 画像の y は上下だけを表すので、正面・背面のどちらでも符号はこのままでよい
    // （旧実装は front のとき符号を反転していたが、それは ±180° 折り返しを
    //   打ち消すための辻褄合わせで、折り返しを直した今は不要かつ有害）。
    const shoulderTilt = tiltFromHorizontal(lSh, rSh);
    metrics.push({
      key: "shoulder_tilt",
      label: "肩の傾き",
      value: shoulderTilt,
      unit: "°",
      hint: shoulderTilt > 0 ? "右肩が下がり" : "左肩が下がり",
      severity: classify(shoulderTilt, WARN.shoulder_tilt),
    });

    const pelvicTilt = tiltFromHorizontal(lHip, rHip);
    metrics.push({
      key: "pelvic_tilt",
      label: "骨盤の傾き",
      value: pelvicTilt,
      unit: "°",
      hint: pelvicTilt > 0 ? "右骨盤が下がり" : "左骨盤が下がり",
      severity: classify(pelvicTilt, WARN.pelvic_tilt),
    });

    // 頭部の傾きは耳のラインで測る。顔が横を向いていると耳幅が潰れて
    // わずかな推定誤差が大きな角度に化けるので、その場合は計測しない。
    const shoulderWidth = Math.abs(rSh.x - lSh.x) || 1;
    const earSpan = Math.abs(rEar.x - lEar.x);
    if (earSpan / shoulderWidth >= CAPTURE.ear_span_min) {
      const headTilt = tiltFromHorizontal(lEar, rEar);
      metrics.push({
        key: "head_tilt",
        label: "頭部の傾き",
        value: headTilt,
        unit: "°",
        hint: headTilt > 0 ? "右側へ傾斜" : "左側へ傾斜",
        severity: classify(headTilt, WARN.head_tilt),
      });
    }

    // 上半身の左右シフト：肩中点と骨盤中点の水平差を肩幅で正規化。
    // 「患者の右方向」が画像のどちら向きかは landmark から決める
    // （正面なら患者の右は画像の左、背面なら画像の右）。
    const rightDir = Math.sign(rSh.x - lSh.x) || 1;
    const midSh = midpoint(lSh, rSh);
    const midHip = midpoint(lHip, rHip);
    const lateralShiftPct = (((midSh.x - midHip.x) * rightDir) / shoulderWidth) * 100;
    metrics.push({
      key: "lateral_shift",
      label: "上半身の左右シフト",
      value: lateralShiftPct,
      unit: "% (肩幅比)",
      hint: lateralShiftPct > 0 ? "右へシフト" : "左へシフト",
      severity: classify(lateralShiftPct, WARN.lateral_shift),
    });

    // 膝のアライメント（O脚・X脚）。UGOQ仕様の L4 判定に使う。
    // 左右の膝の間隔で測ると立ち幅で値が変わってしまうので、
    // 脚ごとに「股関節→足首の線から膝がどれだけ外側へ外れているか」を測り、
    // 下肢長で正規化して左右平均する。立ち方に左右されない。
    const varus = kneeVarusPercent(px, midHip);
    if (varus !== null) {
      metrics.push({
        key: "knee_alignment",
        label: "膝のアライメント",
        value: varus,
        unit: "% (下肢長比)",
        hint: varus > 0 ? "O脚傾向 (膝が外側)" : "X脚傾向 (膝が内側)",
        severity: classify(varus, WARN.knee_alignment),
      });
    }
  }

  if (view === "left" || view === "right") {
    // 側面では左右の landmark が本来ほぼ重なる。MediaPipe は奥行き推定で
    // 両者を前後に散らすため、片側だけを使うとその散らばりをそのまま拾う
    // （この写真では 頭部前方位が 20.2% と 13.5% で 1.5 倍違った）。
    // 左右の中点を使うと散らばりが打ち消され、シルエット上の関節位置に近づく。
    const earMid = midpoint(px[LM.LEFT_EAR], px[LM.RIGHT_EAR]);
    const shMid = midpoint(px[LM.LEFT_SHOULDER], px[LM.RIGHT_SHOULDER]);
    const hipMid = midpoint(px[LM.LEFT_HIP], px[LM.RIGHT_HIP]);
    const facingSign = facingSignFromLandmarks(px, view);
    const torsoHeight = Math.abs(hipMid.y - shMid.y) || 1;

    // 頭部前方位：耳が肩より前にどれだけ出ているか（体幹高比）。
    const fhpRatio = (((earMid.x - shMid.x) * facingSign) / torsoHeight) * 100;
    metrics.push({
      key: "forward_head",
      label: "頭部前方位 (FHP)",
      value: fhpRatio,
      unit: "% (体幹高比)",
      hint: fhpRatio > 0 ? "頭が前方" : "頭が後方",
      severity: classify(fhpRatio, WARN.forward_head),
    });

    // 肩の前方変位：肩が骨盤の垂線よりどれだけ前にあるか。
    const shoulderForward = (((shMid.x - hipMid.x) * facingSign) / torsoHeight) * 100;
    metrics.push({
      key: "shoulder_forward",
      label: "肩の前方変位",
      value: shoulderForward,
      unit: "% (体幹高比)",
      hint: shoulderForward > 0 ? "肩が前方 (巻き肩傾向)" : "肩が後方",
      severity: classify(shoulderForward, WARN.shoulder_forward),
    });

    // 体幹の前後傾：骨盤中点→肩中点 の線が垂直から何度ずれているか。
    const trunkLean =
      Math.atan2((shMid.x - hipMid.x) * facingSign, hipMid.y - shMid.y) * RAD;
    metrics.push({
      key: "trunk_lean",
      label: "体幹の前後傾",
      value: trunkLean,
      unit: "°",
      hint: trunkLean > 0 ? "前傾" : "後傾",
      severity: classify(trunkLean, WARN.trunk_lean),
    });

    // 膝角度（hip-knee-ankle）。左右で足の前後位置が違うので中点は使えない。
    // 手前側＝見えている側の脚を visibility で選ぶ。
    const leg = pickLeg(px);
    if (leg.conf >= VISIBILITY_FLOOR) {
      // 骨盤の前方変位：骨盤が足首よりどれだけ前に出ているか（体幹高比）。
      // 理想姿勢では大転子は外果のほぼ真上に来る。ここが大きく前に出て、
      // かつ肩が骨盤より後ろにあるのが「スウェイバック」の形（UGOQ仕様 L3）。
      const pelvisShift = (((hipMid.x - leg.ankle.x) * facingSign) / torsoHeight) * 100;
      metrics.push({
        key: "pelvis_shift",
        label: "骨盤の前方変位",
        value: pelvisShift,
        unit: "% (体幹高比)",
        hint: pelvisShift > 0 ? "骨盤が前方" : "骨盤が後方",
        severity: classify(pelvisShift, WARN.pelvis_shift),
      });

      const kneeAngle = signedKneeAngle(leg.hip, leg.knee, leg.ankle, facingSign);
      metrics.push({
        key: "knee_angle",
        label: "膝の角度 (hip–knee–ankle)",
        value: kneeAngle,
        unit: "°",
        hint:
          kneeAngle >= KNEE.hyper
            ? "過伸展傾向"
            : kneeAngle >= KNEE.flex
              ? "正常範囲"
              : "屈曲位",
        severity:
          kneeAngle >= KNEE.hyper || kneeAngle < KNEE.flex ? "warn" : "ok",
      });
    }
  }

  // Round numeric values for display.
  return metrics.map((m) => ({
    ...m,
    value: Math.round(m.value * 10) / 10,
  }));
}

// ---- 撮影チェック -------------------------------------------------------
// 計測は止めないが、精度が落ちる撮り方を検出して利用者に伝える。
// 返り値：[{ level: 'error' | 'tip', message }]。error は「そもそも別の向きの
// 写真が入っている」など、数値を信用してはいけない状態。
export function checkCapture(landmarks, view, imageSize) {
  if (!landmarks || landmarks.length < 33) return [];
  const px = toPixels(landmarks, imageSize);
  const notes = [];

  const lSh = px[LM.LEFT_SHOULDER];
  const rSh = px[LM.RIGHT_SHOULDER];
  const shMid = midpoint(lSh, rSh);
  const hipMid = midpoint(px[LM.LEFT_HIP], px[LM.RIGHT_HIP]);
  const torsoHeight = Math.abs(hipMid.y - shMid.y) || 1;
  const widthRatio = Math.abs(rSh.x - lSh.x) / torsoHeight;

  if (view === "front" || view === "back") {
    if (widthRatio < CAPTURE.frontal_ratio_min) {
      notes.push({
        level: "error",
        message: "体が横向きに写っています。正面から撮った写真を選び直してください。",
      });
    }
    const earSpan = Math.abs(px[LM.RIGHT_EAR].x - px[LM.LEFT_EAR].x);
    if (earSpan / (Math.abs(rSh.x - lSh.x) || 1) < CAPTURE.ear_span_min) {
      notes.push({
        level: "tip",
        message: "顔が横を向いているため、頭部の傾きは計測していません。",
      });
    }
  }

  if (view === "left" || view === "right") {
    if (widthRatio > CAPTURE.sagittal_ratio_max) {
      notes.push({
        level: "error",
        message: "体が正面を向いています。真横から撮った写真を選び直してください。",
      });
    } else {
      // 向きが側面として妥当なときだけ、細かい撮影条件を見る。
      const earMid = midpoint(px[LM.LEFT_EAR], px[LM.RIGHT_EAR]);
      const nose = px[LM.NOSE];
      const pitch =
        Math.atan2(nose.y - earMid.y, Math.abs(nose.x - earMid.x)) * RAD;
      if (pitch > CAPTURE.head_pitch_down_max) {
        notes.push({
          level: "tip",
          message:
            "うつむき気味に写っています。目線を正面に戻して撮り直すと、頭部前方位がより正確に出ます。",
        });
      } else if (pitch < CAPTURE.head_pitch_up_min) {
        notes.push({
          level: "tip",
          message:
            "あご先が上がっています。目線を正面に戻して撮り直すと、頭部前方位がより正確に出ます。",
        });
      }
      if (pickLeg(px).conf < VISIBILITY_FLOOR) {
        notes.push({
          level: "tip",
          message: "脚がはっきり写っていないため、膝の角度は計測していません。",
        });
      }
    }
  }

  return notes;
}

// Aggregate cross-view summary used for the report header and rule engine.
export function summarizeAll(metricsByView) {
  const summary = {};
  for (const [view, metrics] of Object.entries(metricsByView)) {
    if (!metrics) continue;
    summary[view] = metrics.map(({ key, label, value, unit, hint, severity }) => ({
      key, label, value, unit, hint, severity,
    }));
  }
  return summary;
}
