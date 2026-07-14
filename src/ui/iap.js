// RevenueCat（Capacitorプラグイン）連携。iOSアプリ内でのみ動作する。
//
// 役割：
//   - アプリ起動時に RevenueCat を初期化し、現在の権利を確認 → あれば有料解除
//   - アップグレードボタンから購入を開始（購入・中断・復元・レシート検証はRevenueCatが担当）
//   - 権利が変わったら、既存のWebブリッジ window.__posturaSetPro(bool) を呼んで
//     レポートの透かし・トレーニングのブラーを即解除／再ロック
//
// ブラウザ（非アプリ）では何もしない＝Web版は無料funnelのまま。
//
// 前提（Capacitorアプリ側の準備。REVENUECAT_SETUP.md 参照）：
//   1) npm i @revenuecat/purchases-capacitor && npx cap sync ios
//   2) RevenueCat ダッシュボードで entitlement "pro" を作り、ASCのサブスク/買い切りを紐付け
//   3) 下の RC_API_KEY に RevenueCat の Apple 用 APIキー（appl_...）を入れる

// ▼ ここを設定：RevenueCat の「Apple App Store」APIキー
const RC_API_KEY = "appl_REPLACE_WITH_YOUR_REVENUECAT_APPLE_KEY";
// ▼ RevenueCat の entitlement 識別子
const ENTITLEMENT = "pro";

function plugin() {
  return (typeof window !== "undefined" && window.Capacitor?.Plugins?.Purchases) || null;
}

function grant(on) {
  try {
    window.__posturaSetPro?.(!!on);
  } catch {
    /* paywall未ロードでも無害 */
  }
}

function entitledFrom(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT];
}

// アプリ起動時に呼ぶ。ブラウザなら即return。
export async function initIap() {
  const P = plugin();
  if (!P) return; // ブラウザ or プラグイン未導入

  try {
    await P.configure({ apiKey: RC_API_KEY });
  } catch (e) {
    console.warn("[IAP] configure失敗（APIキー未設定？）", e);
    return;
  }

  // アップグレードボタン（.upgrade-btn）押下時の動作をネイティブ購入に差し替える。
  window.__posturaUpgrade = async () => {
    try {
      const ok = await purchase();
      if (!ok) console.warn("[IAP] 購入は完了しなかった");
    } catch (e) {
      console.warn("[IAP] 購入エラー", e);
      alert("購入を開始できませんでした。時間をおいて再度お試しください。");
    }
  };

  // 起動時に権利確認（遅れて確定した購入も currentEntitlements で拾える）。
  await refreshEntitlement();

  // 前面復帰のたびに再確認（購入ラグや別端末での購入を反映）。
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshEntitlement();
  });
}

// 現在の権利を確認して解除状態を同期する。
export async function refreshEntitlement() {
  const P = plugin();
  if (!P) return;
  try {
    const res = await P.getCustomerInfo();
    grant(entitledFrom(res?.customerInfo || res));
  } catch (e) {
    console.warn("[IAP] getCustomerInfo失敗", e);
  }
}

// 購入フロー。現在のオファリングの先頭パッケージ（通常は月額）を購入する。
export async function purchase() {
  const P = plugin();
  if (!P) return false;
  const { offerings } = await P.getOfferings();
  const pkg = offerings?.current?.availablePackages?.[0];
  if (!pkg) throw new Error("購入可能な商品がありません（RevenueCatのOffering未設定）");
  const res = await P.purchasePackage({ aPackage: pkg });
  const ok = entitledFrom(res?.customerInfo);
  grant(ok);
  return ok;
}

// 購入の復元（機種変更・再インストール時）。
export async function restore() {
  const P = plugin();
  if (!P) return false;
  const res = await P.restorePurchases();
  const ok = entitledFrom(res?.customerInfo);
  grant(ok);
  return ok;
}

// コンソールから確認できるように公開。
if (typeof window !== "undefined") {
  window.__posturaRestore = restore;
}
