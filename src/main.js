import { detectPose, warmup } from "./pose/detector.js";
import { computeMetrics, summarizeAll } from "./pose/angles.js";
import { setupUpload, resetUpload } from "./ui/upload.js";
import { drawPoseOnCanvas, renderMetrics } from "./ui/overlay.js";
import { renderFindings, renderRawSummary, setStatus, triggerPrint } from "./ui/report.js";
import { generateFindings, getDefaultModel } from "./ai/gemini.js";

const VIEWS = ["front", "back", "left", "right"];
const SETTINGS_KEY = "posture_app_settings_v2";

// Hard-coded default proxy URL (Cloudflare Worker that holds the AI API key server-side).
// Operators can override via the Settings dialog.
const DEFAULT_PROXY_URL = "https://posture-analysis-proxy.tmk4men.workers.dev";

const state = {
  metricsByView: { front: null, back: null, left: null, right: null },
};

function defaultSettings() {
  return {
    mode: "proxy",
    provider: "gemini",
    model: getDefaultModel("gemini"),
    apiKey: "",
    proxyUrl: DEFAULT_PROXY_URL,
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function refreshAnalyzeButton() {
  const hasAny = VIEWS.some((v) => state.metricsByView[v] !== null);
  const consent = document.getElementById("consent-check").checked;
  document.getElementById("analyze-btn").disabled = !(hasAny && consent);
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
    const metrics = landmarks ? computeMetrics(landmarks, view) : null;
    state.metricsByView[view] = metrics;
    renderMetrics(view, metrics);
    setStatus(landmarks ? `${viewLabel(view)} 完了` : `${viewLabel(view)} で骨格を検出できませんでした`);
    updateCarouselDots();
    if (landmarks) {
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

async function onAnalyze() {
  const settings = loadSettings();
  const patient = {
    name: document.getElementById("patient-name").value,
    date: document.getElementById("patient-date").value,
  };
  const summary = summarizeAll(state.metricsByView);

  if (settings.provider === "none") {
    renderRawSummary("計測値の一覧（AIオフ・計測値のみ）:\n\n" + JSON.stringify(summary, null, 2));
    setStatus("計測値のみ表示しました。");
    return;
  }

  setStatus("解析結果を生成中…");
  document.getElementById("analyze-btn").disabled = true;
  try {
    const { findings, raw } = await generateFindings(settings, patient, summary);
    if (findings) {
      renderFindings(findings);
      setStatus("解析結果を生成しました");
    } else {
      renderRawSummary(`AI出力をJSONとして解析できませんでした。生レスポンス:\n\n${raw}`);
      setStatus("AI出力の解析に失敗（生レスポンスを表示）");
    }
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
  }
  document.getElementById("summary-output").innerHTML = "";
  setStatus("");
  refreshAnalyzeButton();
  updateCarouselDots();
  scrollToCard("front");
}

function setupSettingsDialog() {
  const dialog = document.getElementById("settings-dialog");
  const modeSel = document.getElementById("ai-mode");
  const providerSel = document.getElementById("ai-provider");
  const modelInput = document.getElementById("ai-model");
  const keyInput = document.getElementById("ai-key");
  const proxyInput = document.getElementById("proxy-url");
  const proxyField = document.getElementById("proxy-url-field");
  const apiKeyField = document.getElementById("api-key-field");
  const saveBtn = document.getElementById("settings-save");

  function applyModeVisibility() {
    if (modeSel.value === "proxy") {
      proxyField.hidden = false;
      apiKeyField.hidden = true;
    } else {
      proxyField.hidden = true;
      apiKeyField.hidden = false;
    }
  }

  document.getElementById("settings-btn").addEventListener("click", () => {
    const s = loadSettings();
    modeSel.value = s.mode;
    providerSel.value = s.provider;
    modelInput.value = s.model;
    keyInput.value = s.apiKey;
    proxyInput.value = s.proxyUrl;
    applyModeVisibility();
    dialog.showModal();
  });

  modeSel.addEventListener("change", applyModeVisibility);

  providerSel.addEventListener("change", () => {
    modelInput.value = getDefaultModel(providerSel.value);
  });

  saveBtn.addEventListener("click", () => {
    saveSettings({
      mode: modeSel.value,
      provider: providerSel.value,
      model: modelInput.value.trim() || getDefaultModel(providerSel.value),
      apiKey: keyInput.value.trim(),
      proxyUrl: proxyInput.value.trim(),
    });
  });
}

function init() {
  document.getElementById("patient-date").valueAsDate = new Date();

  for (const view of VIEWS) {
    setupUpload(view, handleImage);
  }

  document.getElementById("consent-check").addEventListener("change", refreshAnalyzeButton);
  document.getElementById("analyze-btn").addEventListener("click", onAnalyze);
  document.getElementById("reset-btn").addEventListener("click", onReset);
  document.getElementById("print-btn").addEventListener("click", triggerPrint);

  setupSettingsDialog();
  setupCarouselTracking();

  setStatus("MediaPipe モデルを読み込み中…");
  warmup()
    .then(() => setStatus("準備完了。写真をアップロードしてください。"))
    .catch((err) => {
      console.error(err);
      setStatus(`モデル読み込みエラー: ${err.message}`);
    });
}

init();
