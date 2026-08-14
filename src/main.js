// キャッシュバスター付きの静的 import。?v= は scripts/bump-cache.sh が
// リリースごとに全ソースを一括で書き換える。
//
// 動的 import + トップレベル await は使わない。トップレベル await は
// Safari 15（iOS 15）以降にしか無く、それより古い端末ではファイル自体が
// 構文エラーになってアプリが丸ごと読み込まれない。画面には何も出ないので
// 「写真も選べない・痛み部位も出ない」という症状だけが残る。
import { detectPose, warmup } from "./pose/detector.js?v=20260814-1539";
import { computeMetrics, summarizeAll, checkCapture } from "./pose/angles.js?v=20260814-1539";
import { setupUpload, resetUpload } from "./ui/upload.js?v=20260814-1539";
import { drawPoseOnCanvas, renderMetrics, renderCaptureNotes } from "./ui/overlay.js?v=20260814-1539";
import { renderReport, renderRawSummary, setStatus, triggerPrint } from "./ui/report.js?v=20260814-1539";
import { PAIN_AREA_OPTIONS, deriveRecommendations } from "./pose/recommend.js?v=20260814-1539";
import { requireAuth } from "./ui/auth.js?v=20260814-1539";
import {
  canGenerateReport,
  recordReport,
  remainingReports,
  applyTrainingLock,
  applyWatermark,
  renderLimitReached,
  initEntitlementBridge,
  isPro,
} from "./ui/paywall.js?v=20260814-1539";
import { initIap } from "./ui/iap.js?v=20260814-1539";

const VIEWS = ["front", "right"];

const state = {
  metricsByView: { front: null, right: null },
  // 撮影チェックで「この写真では数値を信用できない」と判定された理由（無ければ null）。
  captureErrors: { front: null, right: null },
};

// 向きが違う写真が入ったままレポートを作らせない。
// 計測自体は動いてしまう（数字は出る）ので、ここで止めないと
// 患者に渡す紙に全く別人のような所見が印字される。
function blockingCaptureError() {
  for (const v of VIEWS) {
    if (state.captureErrors[v]) return { view: v, message: state.captureErrors[v] };
  }
  return null;
}

function refreshAnalyzeButton() {
  const hasAny = VIEWS.some((v) => state.metricsByView[v] !== null);
  document.getElementById("analyze-btn").disabled = !hasAny || !!blockingCaptureError();
  document.getElementById("print-btn").disabled = !hasAny;
}

async function handleImage(view, img) {
  setStatus(`${viewLabel(view)} を解析中…`);
  const card = document.querySelector(`.upload-card[data-view="${view}"]`);
  const canvas = card.querySelector("canvas");
  try {
    const detection = await detectPose(img);
    const landmarks = detection?.landmarks ?? null;
    drawPoseOnCanvas(canvas, img, landmarks);
    // 正規化 landmark は x・y のスケールが違うので、必ず元画像のサイズを渡す。
    // 渡さないと角度も体幹高比も画像のアスペクト比の分だけ歪む。
    const imageSize = { width: img.naturalWidth, height: img.naturalHeight };
    const metrics = landmarks ? computeMetrics(landmarks, view, imageSize) : null;
    const notes = landmarks ? checkCapture(landmarks, view, imageSize) : [];
    state.metricsByView[view] = metrics;
    renderMetrics(view, metrics);
    renderCaptureNotes(view, notes);
    const blocking = notes.find((n) => n.level === "error");
    state.captureErrors[view] = blocking?.message ?? null;
    setStatus(
      !landmarks
        ? `${viewLabel(view)} で骨格を検出できませんでした`
        : blocking
          ? `${viewLabel(view)}：${blocking.message}`
          : `${viewLabel(view)} 完了`,
    );
    updateCarouselDots();
    if (landmarks && !blocking) {
      setTimeout(() => advanceCarousel(view), 550);
    }
  } catch (err) {
    console.error(err);
    setStatus(`エラー: ${err.message}`);
  }
  refreshAnalyzeButton();
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function advanceCarousel(currentView) {
  if (!isMobileViewport()) return;
  const startIdx = VIEWS.indexOf(currentView);
  if (startIdx < 0) return;
  for (let offset = 1; offset < VIEWS.length; offset++) {
    const nextView = VIEWS[(startIdx + offset) % VIEWS.length];
    if (state.metricsByView[nextView] === null) {
      scrollToCard(nextView);
      return;
    }
  }
}

function scrollToCard(view) {
  const card = document.querySelector(`.upload-card[data-view="${view}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

function updateCarouselDots() {
  const dots = document.querySelectorAll("#carousel-dots .dot");
  dots.forEach((dot) => {
    const v = dot.dataset.view;
    dot.classList.toggle("filled", state.metricsByView[v] !== null);
  });
}

function setupCarouselTracking() {
  const grid = document.querySelector(".upload-grid");
  const dots = Array.from(document.querySelectorAll("#carousel-dots .dot"));
  if (!grid || !dots.length) return;

  function setActive(view) {
    dots.forEach((d) => d.classList.toggle("active", d.dataset.view === view));
  }
  setActive("front");

  let scrollRaf = 0;
  grid.addEventListener("scroll", () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const center = grid.scrollLeft + grid.clientWidth / 2;
      let bestView = null;
      let bestDist = Infinity;
      for (const v of VIEWS) {
        const card = grid.querySelector(`.upload-card[data-view="${v}"]`);
        if (!card) continue;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(cardCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestView = v;
        }
      }
      if (bestView) setActive(bestView);
    });
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      if (!isMobileViewport()) return;
      scrollToCard(dot.dataset.view);
    });
  });
}

function viewLabel(view) {
  return { front: "正面", back: "背面", left: "左側面", right: "右側面" }[view];
}

// Capture each view's canvas as a data URL so the report can embed the photo.
function captureCanvasPhotos() {
  const out = {};
  for (const view of VIEWS) {
    const canvas = document.querySelector(`.upload-card[data-view="${view}"] canvas`);
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      try { out[view] = canvas.toDataURL("image/jpeg", 0.85); } catch { /* tainted canvas */ }
    }
  }
  return out;
}

function collectPainAreas() {
  return Array.from(
    document.querySelectorAll('#pain-areas input[type="checkbox"]:checked')
  ).map((el) => el.value);
}

function collectWeeklyFrequency() {
  const raw = document.getElementById("patient-weekly-frequency")?.value;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 2;
  return Math.min(5, Math.max(1, n));
}

function freePlanStatusSuffix() {
  if (isPro()) return "";
  return `（無料プラン：今月あと ${remainingReports()} 件）`;
}

function onAnalyze() {
  const output = document.getElementById("summary-output");

  // 向き違いの写真が残っていたら生成しない（ボタンも無効化しているが二重に防ぐ）。
  const blocked = blockingCaptureError();
  if (blocked) {
    setStatus(`${viewLabel(blocked.view)}：${blocked.message}`);
    return;
  }

  // 無料プランの月間上限に達していたら、レポートを生成せずアップグレード画面を表示。
  if (!canGenerateReport()) {
    renderLimitReached(output);
    setStatus("無料プランの上限に達しました");
    document.getElementById("print-btn").disabled = true;
    return;
  }

  const patient = {
    name: document.getElementById("patient-name").value,
    date: document.getElementById("patient-date").value,
    gender: document.getElementById("patient-gender").value,
    painAreas: collectPainAreas(),
    weeklyFrequency: collectWeeklyFrequency(),
  };
  const summary = summarizeAll(state.metricsByView);

  setStatus("解析結果を生成中…");
  document.getElementById("analyze-btn").disabled = true;
  try {
    // 所見文・筋肉・種目・回数×セットをすべてルールベースで決定的に生成（AI不使用）。
    const findings = deriveRecommendations(
      summary,
      patient.painAreas,
      patient.weeklyFrequency,
    );
    const photos = captureCanvasPhotos();
    renderReport({ findings, patient, photos });
    // 生成が成功したら1件としてカウントし、無料なら透かし＋トレーニング面ロック。
    recordReport();
    applyWatermark(output);
    applyTrainingLock(output);
    setStatus(`解析結果を生成しました${freePlanStatusSuffix()}`);
  } catch (err) {
    console.error(err);
    renderRawSummary(`エラー: ${err.message}`);
    setStatus("生成エラー");
  } finally {
    refreshAnalyzeButton();
  }
}

function onReset() {
  if (!confirm("入力と解析結果をすべてクリアしますか？")) return;
  for (const v of VIEWS) {
    resetUpload(v);
    state.metricsByView[v] = null;
    state.captureErrors[v] = null;
  }
  onResetPainAreas();
  document.getElementById("summary-output").innerHTML = "";
  setStatus("");
  refreshAnalyzeButton();
  updateCarouselDots();
  scrollToCard("front");
}

function renderPainAreaChips() {
  const host = document.getElementById("pain-areas");
  if (!host) return;
  host.innerHTML = PAIN_AREA_OPTIONS.map(
    (opt) => `
      <label class="chip">
        <input type="checkbox" value="${opt.id}" />
        <span>${opt.label}</span>
      </label>
    `
  ).join("");
}

function onResetPainAreas() {
  document
    .querySelectorAll('#pain-areas input[type="checkbox"]:checked')
    .forEach((el) => { el.checked = false; });
}

// 撮影日の初期値。
// input.valueAsDate は使わない。理由は2つ。
//   1) date入力をサポートしない環境（type が text に落ちる）では setter が
//      InvalidStateError を投げ、init() ごと落ちて画面が全部死ぬ。
//   2) valueAsDate は UTC 基準なので、日本時間の朝9時前は前日の日付が入る。
// ローカル時刻から YYYY-MM-DD を組み立てて value に入れる。
function todayLocalISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 初期化の1ステップが落ちても残りを続ける。
// 1箇所の例外で「チップが出ない・写真が選べない」と画面全体が無反応になるのを防ぐ。
function step(label, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[init] ${label} に失敗:`, err);
  }
}

async function init() {
  await requireAuth();

  // ネイティブ（iOS/Apple課金）からの購入確定を受け取る経路を用意。
  // 購入のタイムラグで結果が遅れて届いても、後から確実に解除できるようにする。
  step("課金ブリッジ", initEntitlementBridge);

  // iOSアプリ内なら RevenueCat を初期化（購入・復元・権利同期）。ブラウザでは何もしない。
  step("IAP初期化", initIap);

  step("撮影日の初期値", () => {
    const dateEl = document.getElementById("patient-date");
    if (dateEl) dateEl.value = todayLocalISO();
  });
  step("痛み部位チップ", renderPainAreaChips);

  for (const view of VIEWS) {
    step(`${viewLabel(view)}のアップロード`, () => setupUpload(view, handleImage));
  }

  step("ボタンの配線", () => {
    document.getElementById("analyze-btn").addEventListener("click", onAnalyze);
    document.getElementById("reset-btn").addEventListener("click", onReset);
    document.getElementById("print-btn").addEventListener("click", triggerPrint);
  });

  step("カルーセル", setupCarouselTracking);

  // app.html の保険スクリプトへ「ここまで来た」と伝える。
  window.__posturaReady = true;

  setStatus("MediaPipe モデルを読み込み中…");
  warmup()
    .then(() => setStatus("準備完了。写真をアップロードしてください。"))
    .catch((err) => {
      console.error(err);
      setStatus(`モデル読み込みエラー: ${err.message}`);
    });
}

// 起動が丸ごと落ちた場合、これまでは画面が無言で無反応になり
// 「使えない」以上の情報が残らなかった。原因を画面に出す。
// setStatus 自体が読み込めていない可能性があるので、DOM に直接書く経路を持つ。
function showFatal(message) {
  console.error(message);
  const el = document.getElementById("status-text");
  if (!el) return;
  el.textContent = message;
  el.style.color = "#b3261e";
}

init().catch((err) => {
  showFatal(`起動エラー: ${(err && err.message) || err}`);
});
