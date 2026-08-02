// Renders the 2-page A4 posture report.
// findings shape (built deterministically in src/pose/recommend.js →
// deriveRecommendations; the diagnosis text comes from src/pose/diagnosis.js):
// {
//   diagnosis: string,
//   weakMuscles:  [ { id, note } ],
//   tightMuscles: [ { id, note } ],
//   trainingPlan: [ { assetId } ]            ← page 2 = 4 pre-baked images
// }

const V = new URL(import.meta.url).search;
const [musclesMod, assetsMod, anatomyMod, recommendMod] = await Promise.all([
  import("../data/muscles.js" + V),
  import("../data/exerciseAssets.js" + V),
  import("./anatomy.js" + V),
  import("../pose/recommend.js" + V),
]);
const { MUSCLE_BY_ID } = musclesMod;
const { ASSET_BY_ID } = assetsMod;
const { renderAnatomyPanel } = anatomyMod;
const { painAreaLabels, prescriptionForFrequency } = recommendMod;

const VIEW_LABELS = { front: "正面", back: "背面", left: "左側面", right: "右側面" };

// 患者配布物としての免責。両ページのフッターに常時表示し、医学的診断でないことを明示する。
const DISCLAIMER =
  "このレポートはカメラ計測にもとづく姿勢の傾向を示す健康サポート情報であり、医学的な診断ではありません。気になる症状がある場合は医療機関にご相談ください。";

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

function trainingCardHtml(plan, rx) {
  const asset = ASSET_BY_ID[plan.assetId];
  if (!asset) return "";
  // 画像素材が未入手のマシン（カーフレイズ等）は壊れた画像を出さず、
  // 種目名だけのカードにする。素材を足せば自動で写真つきに戻る。
  const visual = asset.image
    ? `<img class="training-card__img" src="${escapeHtml(asset.image)}" alt="${escapeHtml(asset.label)}" loading="lazy">`
    : `<div class="training-card__noimg">${escapeHtml(asset.label)}</div>`;
  return `
    <li class="training-card">
      ${visual}
      <div class="training-card__rx">
        ${plan.note ? `<div class="training-card__note">${escapeHtml(plan.note)}</div>` : ""}
        <div class="training-card__rx-label">目安</div>
        <div class="training-card__rx-value">
          <span class="training-card__rx-reps">${rx.reps}回</span>
          <span class="training-card__rx-sep">×</span>
          <span class="training-card__rx-sets">${rx.sets}セット</span>
        </div>
      </div>
    </li>
  `;
}

// UGOQ仕様 ⑥「ユーザー画面イメージ」の姿勢分析結果ブロック。
// 【上半身】【下半身】の姿勢タイプ名と、その判定項目・主な改善ポイントを出す。
function postureResultHtml(posture) {
  if (!posture) return "";
  const row = (heading, result) => `
    <div class="posture-type">
      <div class="posture-type__head">【${heading}】</div>
      <div class="posture-type__name">${escapeHtml(result.type.name)}</div>
      <div class="posture-type__meta">
        <span>判定項目：${escapeHtml(result.type.criteria)}</span>
        <span>主な改善ポイント：${escapeHtml(result.type.focus)}</span>
      </div>
    </div>`;
  return `
    <section class="posture-result">
      <h2 class="posture-result__title">姿勢分析結果</h2>
      ${row("上半身", posture.upper)}
      ${row("下半身", posture.lower)}
    </section>`;
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
  const painLabels = painAreaLabels(patient?.painAreas);
  const painChipsHtml = painLabels.length
    ? `<div class="report-pain-areas">
         <span class="report-pain-areas__label">ご申告の不調部位</span>
         ${painLabels
           .map((l) => `<span class="report-pain-chip">${escapeHtml(l)}</span>`)
           .join("")}
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
          ${postureResultHtml(findings.posture)}

          <div class="report-diagnosis">
            ${escapeHtml(findings.diagnosis || "")
              .split(/\n+/)
              .map((p) => `<p>${p}</p>`)
              .join("")}
          </div>

          ${painChipsHtml}

          ${renderAnatomyPanel(weakIds, tightIds, patient?.gender)}
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

      <footer class="report-foot report-foot--disclaimer">
        <small>${DISCLAIMER}</small>
      </footer>
    </article>
  `;

  const freq = Math.min(5, Math.max(1, parseInt(findings.weeklyFrequency, 10) || 2));
  const freqLabel = freq >= 5 ? "週5回以上" : `週${freq}回`;
  const rx = prescriptionForFrequency(freq);

  // 本日のメニュー（UGOQ仕様 ⑤ STEP5〜STEP8／⑥ ユーザー画面イメージ）。
  // ①ウォーミングアップ → ②ラクレッチ3種 → ③筋トレ3種 → ④有酸素（任意） → ⑤クールダウン。
  const posture = findings.posture;
  const cardsFor = (section) =>
    findings.trainingPlan
      .filter((p) => p.section === section)
      .map((p) => trainingCardHtml(p, rx))
      .join("");
  const stretchCards = cardsFor("stretch");
  const strengthCards = cardsFor("strength");
  const noteStep = (num, label, detail) => `
    <li class="menu-step menu-step--note">
      <div class="menu-step__head"><span class="menu-step__num">${num}</span>${escapeHtml(label)}</div>
      <div class="menu-step__detail">${escapeHtml(detail)}</div>
    </li>`;
  // 上下とも正常だった人の目的は「姿勢改善」ではなく「姿勢維持」（先方確定・2026-08-02）。
  const isMaintenance = posture?.menu?.balance === "maintenance";
  const page2Lead = isMaintenance
    ? "今の姿勢を保つための維持トレーニングメニュー"
    : "姿勢チェックの結果に合わせた個別トレーニングメニュー";
  const cardStep = (num, label, cards) => `
    <li class="menu-step">
      <div class="menu-step__head"><span class="menu-step__num">${num}</span>${escapeHtml(label)}</div>
      <ul class="training-grid">
        ${cards || "<li class='training-card training-card--empty'>種目を選定できませんでした</li>"}
      </ul>
    </li>`;

  const page2 = `
    <article class="report-page report-page--2">
      <header class="report-head report-head--green">
        <div class="report-head__brand">POSTURA <span>Training Plan</span></div>
        <h1 class="report-head__title">本日のメニュー（${escapeHtml(freqLabel)}）</h1>
        <p class="report-head__lead">${escapeHtml(page2Lead)}</p>
      </header>

      <ol class="menu-steps">
        ${noteStep("①", posture?.warmup?.label ?? "ウォーミングアップ（5分）", posture?.warmup?.detail ?? "軽い有酸素運動・動的ストレッチ")}
        ${cardStep("②", "ラクレッチ（ストレッチ）", stretchCards)}
        ${cardStep("③", "筋力トレーニング", strengthCards)}
        ${noteStep("④", posture?.cardio?.label ?? "有酸素運動（任意）", posture?.cardio?.detail ?? "ウォーキング15分 など")}
        ${noteStep("⑤", posture?.cooldown?.label ?? "クールダウン（5分）", posture?.cooldown?.detail ?? "胸ストレッチ・深呼吸 など")}
      </ol>

      <footer class="report-foot">
        <small>※ 本メニューは一般的な目安です。症状や体力に応じて、整骨院・トレーナーが個別に調整します。</small>
        <small>※ ${escapeHtml(freqLabel)}、無理のない重さ・可動域で行いましょう。痛みがある場合は中止して施術者にご相談ください。</small>
        <small class="report-foot__disclaimer">${DISCLAIMER}</small>
      </footer>
    </article>
  `;

  container.innerHTML = page1 + page2;
  fitPage1ToA4(container);
}

// 1ページ目をA4（297mm）に収める。
//
// 高さは申告部位の数・所見文の長さ・筋肉名の折り返しで変わるので、CSSの固定値だけでは
// 全ケースを収めきれない（実測で最大 316mm まで伸び、印刷が2枚に割れていた）。
// あふれる分は人体図に吸収させ、収まるまで段階的に縮める。
// 同じ入力なら必ず同じ結果になる（乱数もアニメーションも使わない）。
const A4_HEIGHT_PX = (297 * 96) / 25.4;
const ANATOMY_MAX_PX = 215; // app.css の .anatomy-svg max-height と揃える
const ANATOMY_MIN_PX = 110; // これ以上小さいと筋肉のハイライトが読めない

function fitPage1ToA4(container) {
  const page = container.querySelector(".report-page--1");
  if (!page) return;
  const svgs = page.querySelectorAll(".anatomy-svg");
  if (!svgs.length) return;

  const shrink = () => {
    for (let h = ANATOMY_MAX_PX; h >= ANATOMY_MIN_PX; h -= 5) {
      svgs.forEach((s) => { s.style.maxHeight = `${h}px`; });
      // .report-page には min-height:297mm があるので、中身が収まっているときの
      // ボックス高さはちょうど 297mm になる。これを下回ることは無いため、
      // 判定は「297mm を超えていないか」で行う（余裕を引くと永久に成立せず、
      // 毎回最小サイズまで縮めてしまう）。端数のぶんだけ許容する。
      if (page.getBoundingClientRect().height <= A4_HEIGHT_PX + 0.05) return;
    }
  };
  shrink();

  // 写真は data URL でも読み込みが非同期なので、確定してからもう一度合わせる。
  for (const img of page.querySelectorAll("img")) {
    if (!img.complete) img.addEventListener("load", shrink, { once: true });
  }
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
