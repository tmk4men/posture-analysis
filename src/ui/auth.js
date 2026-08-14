// Lightweight client-side access gate.
//
// 注意：このゲートはブラウザの開発者ツールから容易に突破可能です。
// 「カジュアルな閲覧者を弾く」程度の防御で、本物のセキュリティではありません。
// AI呼び出しのコストを本気で守るならCloudflare Worker側でパスワード検証する必要があります。
//
// パスワード変更：APP_PASSWORD_HASH を新しい値の SHA-256（16進）に置き換える。
//   $ printf '%s' 'new-password' | sha256sum

import { isNativeApp } from "./platform.js?v=20260814-1548";

const APP_PASSWORD_HASH =
  "7291f4ae95ae77fdfd3074d9a7a7dbc05579e1c15622421547cb6cfa9d013c3d"; // sha256("seikotu")

const AUTH_KEY = "posture_app_auth_v1";

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

// パスワードゲートは無効化：Web版もアプリ版とまったく同じく、誰でもそのまま開ける。
// 再有効化する場合は、この return を消して promptForPassword() を呼ぶように戻す。
export function requireAuth() {
  return Promise.resolve();
}

// 旧パスワードゲート（現在は未使用。復活用に残置）。
function promptForPassword() {
  return new Promise((resolve) => {
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
