// 無料プランのゲート（Web版）。
//
// 方針：Web版は「無料お試し」の入口。本気で使う院は有料版（iOSアプリ／Apple課金）へ誘導する。
//   - レポート生成は 1か月あたり FREE_MONTHLY_REPORTS 件までに制限（かなり絞る）。
//   - トレーニングページ（レポート2枚目）は無料だとブラーで隠し、アップグレード導線を重ねる。
//
// ここでは課金処理は行わない（購入は iOSアプリ側）。アップグレードは UPGRADE_URL へ送るだけ。
// オーナーが自端末で解除・確認したい場合はコンソールで  window.__posturaSetPro(true)
//
// 注意：このゲートは開発者ツールから突破可能なクライアント側の緩い制御。売上の要は iOS の
// Apple課金側で担保する前提。ここは「無料で軽く試せる／有料の価値を見せる」ための funnel。

const PRO_KEY = "posture_pro_v1";
const USAGE_KEY = "posture_report_usage_v1";

// 無料プランで1か月に生成できるレポート数。ここを変えれば制限の強さを調整できる。
export const FREE_MONTHLY_REPORTS = 3;

// アップグレード先。TODO: App Store の実URL（有料iOSアプリ）に差し替える。
export const UPGRADE_URL = "./";

export function isPro() {
  try {
    return localStorage.getItem(PRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPro(on) {
  try {
    if (on) localStorage.setItem(PRO_KEY, "1");
    else localStorage.removeItem(PRO_KEY);
  } catch {
    /* localStorage 不可の環境では何もしない */
  }
  // 権利状態が変わったら、いま表示中のレポートに即反映（遅れて届いた購入確定でも解除する）。
  syncUI();
}

const REPORT_CONTAINER_ID = "summary-output";

// いまの権利状態を DOM に反映する。有料化されたら表示中レポートのブラーを外し、
// 失効したら（レポートが出ていれば）ロックし直す。冪等なので何度呼んでも安全。
export function syncUI() {
  const container = document.getElementById(REPORT_CONTAINER_ID);
  if (!container) return;
  if (isPro()) {
    unlockUI(container);
  } else {
    applyWatermark(container);
    applyTrainingLock(container);
  }
}

function unlockUI(container) {
  container.querySelectorAll(".paywall-overlay").forEach((el) => el.remove());
  container.querySelectorAll(".report-watermark").forEach((el) => el.remove());
  container
    .querySelectorAll(".report-page--2.is-locked")
    .forEach((el) => el.classList.remove("is-locked"));
}

// 無料プランでは各レポートページに斜めの透かしを重ねる（印刷にも残る）。
// 透かし自体は CSS（.report-watermark）で描画。CTA より下、本文より上の層に置く。
export function applyWatermark(container) {
  if (isPro()) return;
  container.querySelectorAll(".report-page").forEach((page) => {
    if (page.querySelector(".report-watermark")) return;
    const wm = document.createElement("div");
    wm.className = "report-watermark";
    wm.setAttribute("aria-hidden", "true");
    page.appendChild(wm);
  });
}

// ネイティブ（WebView/Capacitor）から購入確定・失効を受け取るブリッジ。
//
// なぜ必要か：StoreKit の購入は「呼び出しから確定までにタイムラグ」があり、Ask to Buy
// や中断・遅延で結果が後から届くことがある。UI 側が短いタイムアウトで失敗扱いにすると
// 実際には成功した購入がロックされたままになる。そこで Web 側は失敗扱いを一切せず、
// ネイティブが確定を検知した時点で（遅れて届いても）この経路で解除する。
//
// ネイティブからの呼び出し方（どちらでも可）:
//   window.__posturaSetPro(true)                                  // 直接
//   window.postMessage({ type: "posturaEntitlement", pro: true }) // メッセージ経由
export function initEntitlementBridge() {
  window.addEventListener("message", (e) => {
    const d = e && e.data;
    if (d && d.type === "posturaEntitlement") {
      setPro(!!d.pro);
    }
  });
  // 復帰時（バックグラウンド→前面）に、遅れて確定した購入を取りこぼさないよう再同期。
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncUI();
  });
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readUsageMap() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function currentCount() {
  return Number(readUsageMap()[monthKey()]) || 0;
}

// 残り生成可能数。有料は Infinity。
export function remainingReports() {
  if (isPro()) return Infinity;
  return Math.max(0, FREE_MONTHLY_REPORTS - currentCount());
}

export function canGenerateReport() {
  return isPro() || remainingReports() > 0;
}

// レポートを1件生成したものとして今月のカウントを進める。
export function recordReport() {
  if (isPro()) return;
  try {
    const map = readUsageMap();
    const key = monthKey();
    map[key] = (Number(map[key]) || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(map));
  } catch {
    /* 保存できなくても致命的ではない */
  }
}

function ctaHtml(sub) {
  return `
    <div class="paywall-cta">
      <div class="paywall-cta__title">🔒 有料プランで解除</div>
      <p class="paywall-cta__sub">${sub}</p>
      <a class="upgrade-btn" href="${UPGRADE_URL}">有料版にアップグレード →</a>
    </div>`;
}

// レポート2枚目（トレーニング）を無料プランではブラーで隠し、CTAを重ねる。
export function applyTrainingLock(container) {
  if (isPro()) return;
  const page2 = container.querySelector(".report-page--2");
  if (!page2 || page2.querySelector(".paywall-overlay")) return;
  page2.classList.add("is-locked");
  const overlay = document.createElement("div");
  overlay.className = "paywall-overlay";
  overlay.innerHTML = ctaHtml(
    "あなたの姿勢に合わせた個別トレーニングメニューは、有料プランでご覧いただけます。",
  );
  page2.appendChild(overlay);
}

// 今月の上限に達したとき、レポートの代わりに表示するアップグレード画面。
export function renderLimitReached(container) {
  container.innerHTML = `
    <div class="limit-reached">
      ${ctaHtml(
        `無料プランで今月ご利用いただけるレポートは ${FREE_MONTHLY_REPORTS} 件までです。上限に達しました。<br>有料プランならレポートを無制限に作成できます。`,
      )}
    </div>`;
}

// オーナーが自端末で解除・動作確認するためのフック（本番でも無害）。
if (typeof window !== "undefined") {
  window.__posturaSetPro = setPro;
}
