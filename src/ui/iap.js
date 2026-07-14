// Apple純正のApp内課金（StoreKit）を直接使う実装。
// cordova-plugin-purchase（グローバル window.CdvPurchase）でStoreKitをそのまま叩く。
// RevenueCat等の中間サービス・外部アカウントは不要。購入はApp Storeへ直接。
//
// ★購入のタイムラグ対策込み（「呼び出しのラグで購入失敗」を防ぐ）：
//   1) タップ時に商品未ロードでも失敗にせず、オファーが揃うまで待つ（ポーリング）
//   2) ボタンを「準備中…」表示にして誤タップ連打・失敗表示を防ぐ
//   3) 解除は購入完了イベント（finished/receiptUpdated）駆動。order()の戻りが遅れても
//      後から確実に解除（中断・別端末購入・Ask to Buy も拾える）
//   4) ユーザーキャンセルは無言（失敗と誤解させない）
//
// ブラウザ（非アプリ）や未導入時は何もしない＝Web版は無料funnelのまま。
//
// 前提（Capacitorアプリ側。IAP_SETUP.md 参照）：
//   npm install cordova-plugin-purchase && npx cap sync ios
//   Xcode で App の Capability に「In-App Purchase」を追加

const PRODUCTS = {
  monthly: "com.tomoki.postura.monthly", // 月額サブスク
  lifetime: "com.tomoki.postura.lifetime", // 買い切り（非消耗）
};

let initialized = false;

function cdv() {
  return (typeof window !== "undefined" && window.CdvPurchase) || null;
}
function store() {
  return cdv()?.store || null;
}
function grant(on) {
  try {
    window.__posturaSetPro?.(!!on);
  } catch {
    /* paywall未ロードでも無害 */
  }
}

// 月額 or 買い切りのどちらかを所有していれば pro。
function hasPro() {
  const s = store();
  if (!s) return false;
  try {
    return s.owned(PRODUCTS.monthly) || s.owned(PRODUCTS.lifetime);
  } catch {
    return false;
  }
}

function offerOf(which) {
  const s = store();
  const p = s && s.get(PRODUCTS[which]);
  return (p && p.getOffer && p.getOffer()) || null;
}

// 商品の購入オファーが用意できるまで待つ（初期化・読み込みのタイムラグ対策の要）。
async function waitForOffer(which, timeoutMs = 12000) {
  const start = Date.now();
  let offer = offerOf(which);
  while (!offer && Date.now() - start < timeoutMs) {
    try {
      store()?.update?.(); // 商品情報の再取得を促す
    } catch {
      /* noop */
    }
    await new Promise((r) => setTimeout(r, 400));
    offer = offerOf(which);
  }
  return offer;
}

// アプリ起動時に呼ぶ。ブラウザなら即return。
export async function initIap() {
  const CdvPurchase = cdv();
  if (!CdvPurchase) return; // ブラウザ or プラグイン未導入
  const s = CdvPurchase.store;
  const APPLE = CdvPurchase.Platform.APPLE_APPSTORE;

  try {
    s.register([
      { id: PRODUCTS.monthly, type: CdvPurchase.ProductType.PAID_SUBSCRIPTION, platform: APPLE },
      { id: PRODUCTS.lifetime, type: CdvPurchase.ProductType.NON_CONSUMABLE, platform: APPLE },
    ]);

    // 承認された取引を完了させ、所有状態を都度反映（ラグ・中断・後着の取引も拾う）。
    s.when()
      .approved((t) => t.finish())
      .finished(() => grant(hasPro()))
      .receiptUpdated(() => grant(hasPro()));

    await s.initialize([APPLE]);
    initialized = true;
    grant(hasPro());

    window.__posturaUpgrade = () => startUpgrade("monthly");
    window.__posturaRestore = () => restore();

    // 前面復帰のたびに所有状態を再確認（遅れて確定した購入を取りこぼさない）。
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") grant(hasPro());
    });
  } catch (e) {
    console.warn("[IAP] 初期化失敗", e);
  }
}

// ボタン押下時の入口。準備中でも失敗にせず、待ってから購入。多重タップも防ぐ。
let busy = false;
async function startUpgrade(which) {
  if (busy) return;
  busy = true;
  const btn = document.querySelector(".upgrade-btn");
  const label = btn ? btn.textContent : "";
  if (btn) {
    btn.textContent = "準備中…";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";
  }
  try {
    await purchase(which);
  } catch (e) {
    const cancelled = e && e.code === cdv()?.ErrorCode?.PAYMENT_CANCELLED;
    if (cancelled) {
      /* ユーザーキャンセルは無言 */
    } else if (e && e.message === "NOT_READY") {
      alert("読み込み中です。数秒おいて、もう一度お試しください。");
    } else {
      console.warn("[IAP] 購入エラー", e);
      alert("購入を開始できませんでした。時間をおいて再度お試しください。");
    }
  } finally {
    busy = false;
    if (btn) {
      btn.textContent = label;
      btn.style.pointerEvents = "";
      btn.style.opacity = "";
    }
  }
}

// 購入フロー（which: "monthly" | "lifetime"）。実際の解除はイベント駆動なので、
// order() の戻りが遅くても finished/receiptUpdated で確実に反映される。
export async function purchase(which = "monthly") {
  const s = store();
  if (!s) return false;
  const offer = await waitForOffer(which); // ラグ対策：揃うまで待つ
  if (!offer) throw new Error("NOT_READY");
  await s.order(offer);
  return hasPro();
}

// 購入の復元（機種変更・再インストール時）。
export async function restore() {
  const s = store();
  if (!s) return false;
  await s.restorePurchases();
  grant(hasPro());
  return hasPro();
}

if (typeof window !== "undefined") window.__posturaRestore = restore;
