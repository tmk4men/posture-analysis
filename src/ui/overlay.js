import { LM } from "../pose/angles.js";

// Skeleton edges drawn on canvas (subset that is visually meaningful).
const EDGES = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.LEFT_EAR, LM.LEFT_SHOULDER],
  [LM.RIGHT_EAR, LM.RIGHT_SHOULDER],
  [LM.NOSE, LM.LEFT_EAR],
  [LM.NOSE, LM.RIGHT_EAR],
];

export function drawPoseOnCanvas(canvas, image, landmarks) {
  // Size canvas to image, capping width to keep render light.
  const maxW = 720;
  const scale = image.naturalWidth > maxW ? maxW / image.naturalWidth : 1;
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (!landmarks) return;

  const px = (lm) => ({ x: lm.x * canvas.width, y: lm.y * canvas.height });

  // Reference horizontal lines for shoulder and hip — useful for visual asymmetry.
  drawReferenceLine(ctx, px(landmarks[LM.LEFT_SHOULDER]), px(landmarks[LM.RIGHT_SHOULDER]), "#22d3ee");
  drawReferenceLine(ctx, px(landmarks[LM.LEFT_HIP]), px(landmarks[LM.RIGHT_HIP]), "#fb923c");

  // Skeleton edges.
  ctx.strokeStyle = "#a7f3d0";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [a, b] of EDGES) {
    const p1 = px(landmarks[a]);
    const p2 = px(landmarks[b]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Joint dots.
  ctx.fillStyle = "#10b981";
  for (let i = 0; i < landmarks.length; i++) {
    if (i > 32) break;
    const p = px(landmarks[i]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawReferenceLine(ctx, p1, p2, color) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) * 1.4 || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ext = 30;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x - ux * ext, p1.y - uy * ext);
  ctx.lineTo(p2.x + ux * ext, p2.y + uy * ext);
  ctx.stroke();

  // Horizontal reference for comparison.
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  ctx.strokeStyle = color + "66";
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(midX - len / 2, midY);
  ctx.lineTo(midX + len / 2, midY);
  ctx.stroke();
  ctx.restore();
}

export function renderMetrics(view, metrics) {
  const list = document.querySelector(`.metric-list[data-view="${view}"]`);
  if (!metrics || metrics.length === 0) {
    list.classList.remove("has-data");
    list.innerHTML = `<li><span class="metric-name">骨格を検出できませんでした</span></li>`;
    list.classList.add("has-data");
    return;
  }
  list.innerHTML = metrics
    .map(
      (m) => `
      <li>
        <span class="metric-name">${m.label}</span>
        <span class="metric-value ${m.severity === "warn" ? "warn" : ""}">
          ${m.value > 0 ? "+" : ""}${m.value}${m.unit}<small style="color:#94a3b8;margin-left:.4rem">${m.hint ?? ""}</small>
        </span>
      </li>`
    )
    .join("");
  list.classList.add("has-data");
}
