#!/usr/bin/env node
// App Store の掲載文（説明・キーワード・サブタイトル等）を流し込む。
// 既定はドライラン。実行は --yes。冪等（何度実行しても最新の COPY で上書き）。
//
//   node ~/postura/scripts/asc/setup-metadata.mjs 6790814436         # 下見
//   node ~/postura/scripts/asc/setup-metadata.mjs 6790814436 --yes   # 反映
//
// 文言は下の COPY を編集すれば変えられる。

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ============ ここを編集すれば掲載文を変えられる ============
const LOCALE = "ja";
const COPY = {
  subtitle: "写真で姿勢を数値化・記録", // 30字以内
  promotionalText:
    "正面と横の写真から、肩・骨盤・頭の傾きを自動で数値化。結果は端末内だけで処理し、姿勢ケアのトレーニングまで提案します。まずは無料でお試しください。", // 170字以内
  keywords:
    "姿勢,姿勢分析,姿勢チェック,猫背,反り腰,骨格,ストレッチ,トレーニング,整体,整骨院,ボディメイク,肩こり", // 100字以内
  whatsNew: "初回リリースです。写真から姿勢を数値化し、姿勢ケアのトレーニングを提案します。ご意見をお待ちしています。",
  description: `POSTURAは、写真から姿勢の傾向を数値で見える化するアプリです。

■ 特長
・正面／横の写真をとるだけで、肩・骨盤・頭の傾き、左右差、前後の傾きを自動計測
・33点の骨格を端末内で検出（写真は外部に送信しません）
・計測結果にあわせた姿勢ケアのトレーニングメニューを提案
・結果はレポートとして表示・印刷でき、記録や共有に便利

■ こんな方に
・自分の姿勢のクセを客観的に知りたい方
・デスクワークで姿勢が気になる方
・整体・整骨院・トレーニング指導の説明資料に

■ プライバシー
写真や計測結果はすべて端末内で処理され、外部サーバーへ送信しません。

■ 料金
基本機能は無料。月額プラン、または買い切りで、レポートの無制限作成やトレーニングの全機能が使えます。

※本アプリはカメラ計測にもとづく姿勢の傾向の目安を表示するもので、医学的な診断ではありません。気になる症状がある場合は医療機関にご相談ください。`,
};
// =========================================================

const BASE = "https://api.appstoreconnect.apple.com";
const EXECUTE = process.argv.includes("--yes");
const appId = process.argv.find((a) => /^\d+$/.test(a));

function loadConfig() {
  if (process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID && process.env.ASC_KEY_PATH) {
    return { keyId: process.env.ASC_KEY_ID, issuerId: process.env.ASC_ISSUER_ID, keyPath: path.resolve(process.env.ASC_KEY_PATH) };
  }
  for (const f of [path.join(process.cwd(), ".asc.json"), path.join(os.homedir(), ".asc", "config.json"), path.join(os.homedir(), ".asc.json")]) {
    if (!fs.existsSync(f)) continue;
    const c = JSON.parse(fs.readFileSync(f, "utf8"));
    const p = c.profiles ? c.profiles[c.default || Object.keys(c.profiles)[0]] : c;
    if (p && p.keyId && p.issuerId && p.keyPath) {
      const kp = path.isAbsolute(p.keyPath) ? p.keyPath : path.resolve(path.dirname(f), p.keyPath);
      return { keyId: p.keyId, issuerId: p.issuerId, keyPath: kp };
    }
  }
  throw new Error("認証情報が見つかりません（~/.asc/config.json）。");
}
function b64url(x) { return Buffer.from(x).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function token() {
  const cfg = loadConfig();
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId, typ: "JWT" }));
  const p = b64url(JSON.stringify({ iss: cfg.issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }));
  const key = crypto.createPrivateKey(fs.readFileSync(cfg.keyPath));
  return `${h}.${p}.${b64url(crypto.sign("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" }))}`;
}
const TOK = token();
async function api(method, endpoint, body) {
  const res = await fetch(BASE + endpoint, { method, headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${endpoint}\n` + (json?.errors?.map((e) => `${e.status} ${e.title}: ${e.detail}`).join("\n") || text));
  return json;
}

async function patch(label, endpoint, type, id, attributes) {
  if (!EXECUTE) {
    console.log(`  ＋更新予定: ${label}`);
    return;
  }
  await api("PATCH", endpoint, { data: { type, id, attributes } });
  console.log(`  ✅ 更新: ${label}`);
}

async function main() {
  if (!appId) {
    console.error("使い方: node setup-metadata.mjs <appId> [--yes]");
    process.exit(1);
  }
  console.log(`アプリ ${appId} の掲載文 ${EXECUTE ? "【反映】" : "【ドライラン：変更しません】"}\n`);

  const EDITABLE = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "WAITING_FOR_REVIEW", "INVALID_BINARY"]);

  // 1) バージョンの説明文・キーワード・宣伝文・新機能
  console.log("■ バージョン掲載文（説明・キーワード・宣伝文・新機能）");
  const vers = await api("GET", `/v1/apps/${appId}/appStoreVersions?limit=20`);
  const ver = (vers.data || []).find((v) => EDITABLE.has(v.attributes.appStoreState)) || vers.data?.[0];
  if (!ver) console.log("  ⚠ バージョンが見つかりません");
  else {
    const locs = await api("GET", `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`);
    const loc = (locs.data || []).find((l) => l.attributes.locale === LOCALE);
    if (!loc) console.log(`  ⚠ ${LOCALE} のローカライズがありません（画面で日本語を追加してから）`);
    else
      await patch(`version localization ${LOCALE}`, `/v1/appStoreVersionLocalizations/${loc.id}`, "appStoreVersionLocalizations", loc.id, {
        description: COPY.description,
        keywords: COPY.keywords,
        promotionalText: COPY.promotionalText,
        whatsNew: COPY.whatsNew,
      });
  }

  // 2) アプリ情報のサブタイトル
  console.log("■ サブタイトル");
  const infos = await api("GET", `/v1/apps/${appId}/appInfos?limit=10`);
  const info = infos.data?.[0];
  if (!info) console.log("  ⚠ appInfo が見つかりません");
  else {
    const ilocs = await api("GET", `/v1/appInfos/${info.id}/appInfoLocalizations?limit=50`);
    const iloc = (ilocs.data || []).find((l) => l.attributes.locale === LOCALE);
    if (!iloc) console.log(`  ⚠ ${LOCALE} のアプリ情報ローカライズがありません`);
    else await patch(`appInfo localization ${LOCALE}`, `/v1/appInfoLocalizations/${iloc.id}`, "appInfoLocalizations", iloc.id, { subtitle: COPY.subtitle });
  }

  console.log(`\n${EXECUTE ? "完了。App Store Connect の画面で反映を確認してください。" : "ドライラン完了。問題なければ --yes で反映してください。"}`);
}

main().catch((e) => {
  console.error("\n[エラー] " + (e.message || e));
  console.error("※ 冪等なので、原因を直して再実行すればOKです。");
  process.exit(1);
});
