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

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Signed tilt of line a→b vs horizontal axis (degrees).
// Positive = b is lower than a in image (since y grows downward).
function tiltFromHorizontal(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * RAD;
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

// Given normalized landmarks (0..1), return metrics dict per view.
// view: 'front' | 'back' | 'left' | 'right'
export function computeMetrics(landmarks, view) {
  if (!landmarks || landmarks.length < 33) return [];
  const lm = landmarks;
  const metrics = [];

  if (view === "front" || view === "back") {
    // Shoulder tilt: line from patient-left shoulder to patient-right shoulder
    const lSh = lm[LM.LEFT_SHOULDER];
    const rSh = lm[LM.RIGHT_SHOULDER];
    const shoulderTilt = tiltFromHorizontal(lSh, rSh);
    // For 'front' view, left shoulder appears on image-right; mirror sign so positive always means
    // the patient's right shoulder is lower than the left.
    const shoulderTiltAdjusted = view === "front" ? -shoulderTilt : shoulderTilt;
    metrics.push({
      key: "shoulder_tilt",
      label: "肩の傾き",
      value: shoulderTiltAdjusted,
      unit: "°",
      hint: shoulderTiltAdjusted > 0 ? "右肩が下がり" : "左肩が下がり",
      severity: classify(shoulderTiltAdjusted, 2),
    });

    // Pelvic tilt
    const lHip = lm[LM.LEFT_HIP];
    const rHip = lm[LM.RIGHT_HIP];
    const pelvicTilt = tiltFromHorizontal(lHip, rHip);
    const pelvicTiltAdjusted = view === "front" ? -pelvicTilt : pelvicTilt;
    metrics.push({
      key: "pelvic_tilt",
      label: "骨盤の傾き",
      value: pelvicTiltAdjusted,
      unit: "°",
      hint: pelvicTiltAdjusted > 0 ? "右骨盤が下がり" : "左骨盤が下がり",
      severity: classify(pelvicTiltAdjusted, 2),
    });

    // Head tilt (ear line)
    const lEar = lm[LM.LEFT_EAR];
    const rEar = lm[LM.RIGHT_EAR];
    const headTilt = tiltFromHorizontal(lEar, rEar);
    const headTiltAdjusted = view === "front" ? -headTilt : headTilt;
    metrics.push({
      key: "head_tilt",
      label: "頭部の傾き",
      value: headTiltAdjusted,
      unit: "°",
      hint: headTiltAdjusted > 0 ? "右側へ傾斜" : "左側へ傾斜",
      severity: classify(headTiltAdjusted, 3),
    });

    // Lateral shift: midshoulder vs midhip horizontal offset (normalized to shoulder width)
    const midSh = midpoint(lSh, rSh);
    const midHip = midpoint(lHip, rHip);
    const shoulderWidth = Math.hypot(rSh.x - lSh.x, rSh.y - lSh.y) || 1;
    const lateralShiftPct = ((midSh.x - midHip.x) / shoulderWidth) * 100;
    const shiftAdjusted = view === "front" ? -lateralShiftPct : lateralShiftPct;
    metrics.push({
      key: "lateral_shift",
      label: "上半身の左右シフト",
      value: shiftAdjusted,
      unit: "% (肩幅比)",
      hint: shiftAdjusted > 0 ? "右へシフト" : "左へシフト",
      severity: classify(shiftAdjusted, 5),
    });
  }

  if (view === "left" || view === "right") {
    // Pick the side that faces the camera (more reliable landmarks).
    // 'left' view = patient's left side toward camera → use LEFT_* landmarks.
    const isLeftView = view === "left";
    const ear = isLeftView ? lm[LM.LEFT_EAR] : lm[LM.RIGHT_EAR];
    const sh = isLeftView ? lm[LM.LEFT_SHOULDER] : lm[LM.RIGHT_SHOULDER];
    const hip = isLeftView ? lm[LM.LEFT_HIP] : lm[LM.RIGHT_HIP];
    const knee = isLeftView ? lm[LM.LEFT_KNEE] : lm[LM.RIGHT_KNEE];
    const ankle = isLeftView ? lm[LM.LEFT_ANKLE] : lm[LM.RIGHT_ANKLE];

    // Forward head posture: horizontal offset of ear from shoulder, normalized to torso height.
    const torsoHeight = Math.abs(hip.y - sh.y) || 1;
    // For left view, patient faces left of image → "forward" = -x direction.
    // For right view, patient faces right of image → "forward" = +x direction.
    const facingSign = isLeftView ? -1 : 1;
    const fhpRatio = ((ear.x - sh.x) * facingSign) / torsoHeight * 100;
    metrics.push({
      key: "forward_head",
      label: "頭部前方位 (FHP)",
      value: fhpRatio,
      unit: "% (体幹高比)",
      hint: fhpRatio > 0 ? "頭が前方" : "頭が後方",
      severity: classify(fhpRatio, 10),
    });

    // Shoulder forward posture: horizontal offset of shoulder from hip vertical line.
    const shoulderForward = ((sh.x - hip.x) * facingSign) / torsoHeight * 100;
    metrics.push({
      key: "shoulder_forward",
      label: "肩の前方変位",
      value: shoulderForward,
      unit: "% (体幹高比)",
      hint: shoulderForward > 0 ? "肩が前方 (巻き肩傾向)" : "肩が後方",
      severity: classify(shoulderForward, 8),
    });

    // Pelvic tilt (sagittal): angle of hip→shoulder line vs vertical.
    const trunkAngle = Math.atan2(sh.x - hip.x, hip.y - sh.y) * RAD; // 0 = vertical
    const trunkAdjusted = trunkAngle * facingSign;
    metrics.push({
      key: "trunk_lean",
      label: "体幹の前後傾",
      value: trunkAdjusted,
      unit: "°",
      hint: trunkAdjusted > 0 ? "前傾" : "後傾",
      severity: classify(trunkAdjusted, 5),
    });

    // Knee angle (hip-knee-ankle). 180° = fully extended, <180 flexed, >180 hyperextended.
    const kneeAngle = innerAngle(hip, knee, ankle);
    metrics.push({
      key: "knee_angle",
      label: "膝の角度 (hip–knee–ankle)",
      value: kneeAngle,
      unit: "°",
      hint:
        kneeAngle >= 178
          ? "過伸展傾向"
          : kneeAngle >= 170
            ? "正常範囲"
            : "屈曲位",
      severity: kneeAngle >= 178 || kneeAngle < 165 ? "warn" : "ok",
    });
  }

  // Round numeric values for display.
  return metrics.map((m) => ({
    ...m,
    value: Math.round(m.value * 10) / 10,
  }));
}

// Aggregate cross-view summary used for AI prompt and report header.
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
