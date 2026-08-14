// POSTURA PWA Service Worker
// オフライン起動とモデルの端末キャッシュを担う。
//
// 方針（既存の ?v= キャッシュバスターを壊さないこと）:
//   - 同一オリジン（HTML/CSS/JS）  … network-first。オンライン時は常に最新（?v= が効く）、
//                                      オフライン時のみキャッシュへフォールバック。
//   - MediaPipe（CDN・WASM・モデル）… cache-first。パスにバージョンが含まれ不変なので、
//                                      一度取得したら端末内から高速・オフライン再生。
//
// キャッシュ名を上げると（例: v1 -> v2）activate 時に旧キャッシュを一掃する。

// CORE はリリースのたびに上げる（古いアプリシェルを確実に捨てる）。
// RUNTIME は据え置き。ここには MediaPipe のモデル（約30MB）が入っていて、
// 名前を変えると全員が再ダウンロードになる。中身は不変なので捨てる理由がない。
const CORE = "postura-core-v2";
const RUNTIME = "postura-runtime-v1";

// インストール時に確実に持っておきたい最小シェル（?v= を付けない素のパス）。
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

// MediaPipe 一式の配信元。ここ宛ては cache-first で端末に貯める。
const MP_HOSTS = ["cdn.jsdelivr.net", "storage.googleapis.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CORE)
      // 1つ 404 でも install 全体を失敗させないよう allSettled。
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CORE && k !== RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // MediaPipe（不変・大容量）: cache-first
  if (MP_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 同一オリジン: network-first（?v= を尊重しつつオフライン耐性を付与）
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
    return;
  }

  // それ以外の外部リソースは素通し。
});

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // 通常応答（CORS可）と opaque の両方を保存対象にする。
  if (res && (res.ok || res.type === "opaque")) {
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // 完全一致 → クエリ無視 の順でキャッシュを探す。
    const hit =
      (await cache.match(req)) ||
      (await cache.match(req, { ignoreSearch: true })) ||
      (await caches.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    // ナビゲーション時はアプリシェルへフォールバック。
    if (req.mode === "navigate") {
      const shell =
        (await caches.match("./app.html")) ||
        (await caches.match("./index.html"));
      if (shell) return shell;
    }
    throw err;
  }
}
