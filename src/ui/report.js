// Renders the 2-page A4 posture report.
// findings shape (after AI sanitisation in src/ai/gemini.js):
// {
//   diagnosis: string,
//   weakMuscles:  [ { id, note } ],
//   tightMuscles: [ { id, note } ],
//   trainingPlan: [ { assetId } ]            ← page 2 = 4 pre-baked images
// }

const V = new URL(import.meta.url).search;
const [musclesMod, assetsMod, anatomyMod] = await Promise.all([
  import("../data/muscles.js" + V),
  import("../data/exerciseAssets.js" + V),
  import("./anatomy.js" + V),
]);
const { MUSCLE_BY_ID } = musclesMod;
const { ASSET_BY_ID } = assetsMod;
const { renderAnatomyPanel } = anatomyMod;

const VIEW_LABELS = { front: "正面", back: "背面", left: "左側面", right: "右側面" };

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatPatientDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return escapeHtml(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// Pick the best photo to include in the report. Prefer the side view since
// posture diagnostics (FHP, shoulder-forward) come from it.
function pickPhotoDataUrl(canvasDataUrls) {
  if (!canvasDataUrls) return { url: null, view: null };
  for (const view of ["right", "front"]) {
    if (canvasDataUrls[view]) return { url: canvasDataUrls[view], view };
  }
  return { url: null, view: null };
}

function muscleCardHtml(item, role) {
  const def = MUSCLE_BY_ID[item.id];
  if (!def) return "";
  const note = item.note || (role === "weak" ? def.weakNote : def.tightNote);
  return `
    <li class="muscle-card muscle-card--${role}">
      <div class="muscle-card__label">${escapeHtml(def.label)}</div>
      <div class="muscle-card__note">${escapeHtml(note)}</div>
    </li>
  `;
}

function trainingCardHtml(plan) {
  const asset = ASSET_BY_ID[plan.assetId];
  if (!asset) return "";
  return `
    <li class="training-card">
      <img class="training-card__img" src="${escapeHtml(asset.image)}" alt="${escapeHtml(asset.label)}" loading="lazy">
    </li>
  `;
}

export function renderReport({ findings, patient, photos }) {
  const container = document.getElementById("summary-output");
  container.innerHTML = "";

  if (!findings) {
    container.innerHTML = `<p class="empty-state">解析結果が取得できませんでした。</p>`;
    return;
  }

  const { url: photoUrl, view: photoView } = pickPhotoDataUrl(photos);
  const weakIds = findings.weakMuscles.map((m) => m.id);
  const tightIds = findings.tightMuscles.map((m) => m.id);

  const patientName = patient?.name ? escapeHtml(patient.name) : "—";
  const patientDate = patient?.date ? formatPatientDate(patient.date) : "";

  const type = findings.postureType;
  const typeBadge = type
    ? `<div class="posture-type posture-type--${escapeHtml(type.id)}">
         <span class="posture-type__no">${escapeHtml(String(type.no))}</span>
         <div class="posture-type__body">
           <div class="posture-type__label">姿勢タイプ：${escapeHtml(type.label)}</div>
           <div class="posture-type__desc">${escapeHtml(type.description || "")}</div>
           ${type.reasons && type.reasons.length
             ? `<div class="posture-type__reasons">所見：${escapeHtml(type.reasons.join(" / "))}</div>`
             : ""}
         </div>
       </div>`
    : "";

  const page1 = `
    <article class="report-page report-page--1">
      <header class="report-head">
        <div class="report-head__brand">POSTURA <span>Posture Analysis</span></div>
        <h1 class="report-head__title">現在の姿勢・筋肉状態チェック</h1>
        <div class="report-head__meta">
          <span>患者氏名：<b>${patientName}</b></span>
          ${patientDate ? `<span>撮影日：<b>${patientDate}</b></span>` : ""}
        </div>
        ${typeBadge}
      </header>

      <section class="report-page1-body">
        <div class="report-photo">
          ${
            photoUrl
              ? `<img src="${photoUrl}" alt="姿勢写真">
                 <div class="report-photo__caption">${escapeHtml(VIEW_LABELS[photoView] || "")}</div>`
              : `<div class="report-photo__placeholder">写真未取得</div>`
          }
        </div>

        <div class="report-right">
          <div class="report-diagnosis">
            ${escapeHtml(findings.diagnosis || "")
              .split(/\n+/)
              .map((p) => `<p>${p}</p>`)
              .join("")}
          </div>

          ${renderAnatomyPanel(weakIds, tightIds)}
        </div>
      </section>

      <section class="muscle-lists">
        <div class="muscle-list muscle-list--weak">
          <header>
            <span class="muscle-list__icon">●</span>
            <span class="muscle-list__title">弱化している筋肉</span>
            <span class="muscle-list__sub">鍛えるべき筋肉</span>
          </header>
          <ul>${findings.weakMuscles.map((m) => muscleCardHtml(m, "weak")).join("") || "<li class='muscle-card muscle-card--empty'>—</li>"}</ul>
        </div>
        <div class="muscle-list muscle-list--tight">
          <header>
            <span class="muscle-list__icon">▲</span>
            <span class="muscle-list__title">短縮・硬くなっている筋肉</span>
            <span class="muscle-list__sub">ほぐすべき筋肉</span>
          </header>
          <ul>${findings.tightMuscles.map((m) => muscleCardHtml(m, "tight")).join("") || "<li class='muscle-card muscle-card--empty'>—</li>"}</ul>
        </div>
      </section>

      <footer class="report-foot">
        <small>※ 本所見はAIによる姿勢推定値からの自動生成であり、医学的診断ではありません。施術判断は施術者によります。</small>
      </footer>
    </article>
  `;

  const trainingCards = findings.trainingPlan
    .map((p) => trainingCardHtml(p))
    .join("");

  const page2 = `
    <article class="report-page report-page--2">
      <header class="report-head report-head--green">
        <div class="report-head__brand">POSTURA <span>Training Plan</span></div>
        <h1 class="report-head__title">姿勢改善 週2回プログラム</h1>
        <p class="report-head__lead">姿勢分析の結果に基づく個別トレーニングメニュー</p>
      </header>

      <ul class="training-grid">
        ${trainingCards || "<li class='training-card training-card--empty'>マシン推奨を生成できませんでした</li>"}
      </ul>

      <footer class="report-foot">
        <small>※ 週2回、無理のない重さ・可動域で行いましょう。痛みがある場合は中止して施術者にご相談ください。</small>
      </footer>
    </article>
  `;

  container.innerHTML = page1 + page2;
}

// Backwards-compatible wrapper for the old call sites (raw text fallback).
export function renderRawSummary(text) {
  const container = document.getElementById("summary-output");
  container.innerHTML = `<pre class="raw-summary">${escapeHtml(text)}</pre>`;
}

export function setStatus(text) {
  document.getElementById("status-text").textContent = text;
}

export function triggerPrint() {
  window.print();
}
