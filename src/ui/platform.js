// 実行環境の判定。auth.js と paywall.js が同じ基準を使うためにここに置く。
//
// 「ネイティブアプリの中で開かれているか」だけを見る。
// 判定サイン（どれか1つ当たれば「アプリ内」とみなす）:
//   - Capacitor / Cordova で包んでいる（window.Capacitor / window.cordova）
//   - ネイティブが window.__POSTURA_NATIVE__ = true を注入
//   - 読み込みURLに ?native=1 か #native を付与
//   - capacitor:// や file:// で読み込んでいる
// 一度アプリ内と判定したら localStorage に記録し、以降の画面遷移でも省略する。

const NATIVE_KEY = "posture_native_v1";

export function isNativeApp() {
  try {
    if (localStorage.getItem(NATIVE_KEY) === "1") return true;
  } catch {
    /* localStorage 不可でも続行 */
  }
  const detected =
    typeof window !== "undefined" &&
    (!!window.Capacitor ||
      !!window.cordova ||
      window.__POSTURA_NATIVE__ === true ||
      location.protocol === "capacitor:" ||
      location.protocol === "file:" ||
      /[?&]native=1\b/.test(location.search) ||
      /(^|[#&])native\b/.test(location.hash));
  if (detected) {
    try {
      localStorage.setItem(NATIVE_KEY, "1");
    } catch {
      /* 記録できなくても致命的ではない */
    }
  }
  return detected;
}
