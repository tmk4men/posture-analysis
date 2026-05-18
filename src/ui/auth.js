// Lightweight client-side access gate.
//
// 注意：このゲートはブラウザの開発者ツールから容易に突破可能です。
// 「カジュアルな閲覧者を弾く」程度の防御で、本物のセキュリティではありません。
// AI呼び出しのコストを本気で守るならCloudflare Worker側でパスワード検証する必要があります。
//
// パスワード変更：APP_PASSWORD_HASH を新しい値の SHA-256（16進）に置き換える。
//   $ printf '%s' 'new-password' | sha256sum

const APP_PASSWORD_HASH =
  "e56d8357befe6040fe63ca6b1031938b6f772a5f5d93be6fc7bbf0d92b8252f5"; // sha256("tk1216")

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

export function requireAuth() {
  return new Promise((resolve) => {
    if (isAuthed()) {
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
