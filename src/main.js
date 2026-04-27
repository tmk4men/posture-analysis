import { detectPose, warmup } from "./pose/detector.js";
import { computeMetrics, summarizeAll } from "./pose/angles.js";
import { setupUpload, resetUpload } from "./ui/upload.js";
import { drawPoseOnCanvas, renderMetrics } from "./ui/overlay.js";
import { renderFindings, renderRawSummary, setStatus, triggerPrint } from "./ui/report.js";
import { generateFindings, getDefaultModel } from "./ai/gemini.js";

const VIEWS = ["front", "back", "left", "right"];
const SETTINGS_KEY = "posture_app_settings_v1";

const state = {
  metricsByView: { front: null, back: null, left: null, right: null },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { provider: "gemini", model: getDefaultModel("gemini"), apiKey: "" };
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider || "gemini",
      model: parsed.model || getDefaultModel(parsed.provider || "gemini"),
      apiKey: parsed.apiKey || "",
    };
  } catch {
    return { provider: "gemini", model: getDefaultModel("gemini"), apiKey: "" };
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
  } catch (err) {
    console.error(err);
    setStatus(`エラー: ${err.message}`);
  }
  refreshAnalyzeButton();
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

  if (settings.provider === "none" || !settings.apiKey) {
    renderRawSummary(
      "計測値の一覧（AI所見はオフ）:\n\n" + JSON.stringify(summary, null, 2)
    );
    setStatus("AI所見は無効。計測値のみ表示しました。");
    return;
  }

  setStatus("AI所見を生成中…");
  document.getElementById("analyze-btn").disabled = true;
  try {
    const { findings, raw } = await generateFindings(settings, patient, summary);
    if (findings) {
      renderFindings(findings);
      setStatus("AI所見を生成しました");
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
  document.getElementById("summary-output").innerHTML =
    `<p class="placeholder">写真をアップロードし「AI所見を生成」を押してください。</p>`;
  setStatus("");
  refreshAnalyzeButton();
}

function setupSettingsDialog() {
  const dialog = document.getElementById("settings-dialog");
  const providerSel = document.getElementById("ai-provider");
  const modelInput = document.getElementById("ai-model");
  const keyInput = document.getElementById("ai-key");
  const saveBtn = document.getElementById("settings-save");

  document.getElementById("settings-btn").addEventListener("click", () => {
    const s = loadSettings();
    providerSel.value = s.provider;
    modelInput.value = s.model;
    keyInput.value = s.apiKey;
    dialog.showModal();
  });

  providerSel.addEventListener("change", () => {
    modelInput.value = getDefaultModel(providerSel.value);
  });

  saveBtn.addEventListener("click", (e) => {
    // Prevent default close so we can save first; dialog still closes via form method=dialog.
    saveSettings({
      provider: providerSel.value,
      model: modelInput.value.trim() || getDefaultModel(providerSel.value),
      apiKey: keyInput.value.trim(),
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

  setStatus("MediaPipe モデルを読み込み中…");
  warmup()
    .then(() => setStatus("準備完了。写真をアップロードしてください。"))
    .catch((err) => {
      console.error(err);
      setStatus(`モデル読み込みエラー: ${err.message}`);
    });
}

init();
