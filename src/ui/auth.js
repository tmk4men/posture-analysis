// Lightweight client-side access gate.
//
// 注意：このゲートはブラウザの開発者ツールから容易に突破可能です。
// 「カジュアルな閲覧者を弾く」程度の防御で、本物のセキュリティではありません。
// AI呼び出しのコストを本気で守るならCloudflare Worker側でパスワード検証する必要があります。
//
// パスワード変更：APP_PASSWORD_HASH を新しい値の SHA-256（16進）に置き換える。
//   $ printf '%s' 'new-password' | sha256sum

const APP_PASSWORD_HASH =
  "7291f4ae95ae77fdfd3074d9a7a7dbc05579e1c15622421547cb6cfa9d013c3d"; // sha256("seikotu")

const AUTH_KEY = "posture_app_auth_v1";
const NATIVE_KEY = "posture_native_v1";

// iOSアプリ（ネイティブの入れ物）の中で開かれているかを判定する。
// ここが true のときはパスワードを出さない（アプリ利用者に毎回入力させない）。
//
// 判定サイン（どれか1つ当たれば「アプリ内」とみなす）:
//   - Capacitor / Cordova で包んでいる（window.Capacitor / window.cordova）… iOS側の変更不要
//   - ネイティブが window.__POSTURA_NATIVE__ = true を注入
//   - 読み込みURLに ?native=1 か #native を付与
//   - capacitor:// や file:// で読み込んでいる
// 一度アプリ内と判定したら localStorage に記録し、以降の画面遷移でも省略する。
function isNativeApp() {
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

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isAuthed() {
  return (
    localStorage.getItem(AUTH_KEY) === "ok" ||
    sessionStorage.getItem(AUTH_KEY) === "ok"
  );
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
}

export function requireAuth() {
  return new Promise((resolve) => {
    // iOSアプリ内ならパスワードを出さずに通す。Web（ブラウザ）は従来どおり要求。
    if (isNativeApp() || isAuthed()) {
      resolve();
      return;
    }

    const dialog = document.getElementById("auth-dialog");
    const form = document.getElementById("auth-form");
    const input = document.getElementById("auth-password");
    const errorEl = document.getElementById("auth-error");
    const rememberEl = document.getElementById("auth-remember");

    document.body.classList.add("auth-locked");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");

    setTimeout(() => input?.focus(), 50);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.textContent = "";
      const hash = await sha256Hex(input.value || "");
      if (hash === APP_PASSWORD_HASH) {
        const store = rememberEl.checked ? localStorage : sessionStorage;
        store.setItem(AUTH_KEY, "ok");
        document.body.classList.remove("auth-locked");
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
        resolve();
      } else {
        errorEl.textContent = "パスワードが違います。";
        input.value = "";
        input.focus();
      }
    });
  });
}
