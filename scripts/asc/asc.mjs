#!/usr/bin/env node
// App Store Connect API 自動化CLI（外部依存なし・Node標準のみ）。
//
// 認証情報（3点）は環境変数 or scripts/asc/.asc.json から読む。秘密鍵(.p8)は端末内に置き、
// 絶対にコミットしない（.gitignore 済み）。
//   ASC_KEY_ID     … キーID
//   ASC_ISSUER_ID  … Issuer ID
//   ASC_KEY_PATH   … .p8 のパス
//
// 使い方:
//   node scripts/asc/asc.mjs token                 # JWT を出力（curl等のデバッグ用）
//   node scripts/asc/asc.mjs apps                  # 自分のアプリ一覧（id/名前/bundleId）
//   node scripts/asc/asc.mjs builds <appId>        # ビルド一覧
//   node scripts/asc/asc.mjs iaps <appId>          # App内課金（非消耗/消耗等）一覧
//   node scripts/asc/asc.mjs subgroups <appId>     # サブスクグループ一覧
//   node scripts/asc/asc.mjs subs <groupId>        # グループ内サブスク一覧
//   node scripts/asc/asc.mjs get <path> [k=v ...]  # 任意GET（例: get /v1/apps limit=5）
//   node scripts/asc/asc.mjs sales <vendorId>      # 前日の売上サマリーレポート(gz)を保存
//
// 参考: https://developer.apple.com/documentation/appstoreconnectapi

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://api.appstoreconnect.apple.com";

// ---------- 認証 ----------

function loadConfig() {
  const env = {
    keyId: process.env.ASC_KEY_ID,
    issuerId: process.env.ASC_ISSUER_ID,
    keyPath: process.env.ASC_KEY_PATH,
  };
  if (env.keyId && env.issuerId && env.keyPath) {
    return { ...env, keyPath: path.resolve(env.keyPath) };
  }
  const cfgPath = path.join(HERE, ".asc.json");
  if (fs.existsSync(cfgPath)) {
    const c = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (!c.keyId || !c.issuerId || !c.keyPath) {
      throw new Error(".asc.json に keyId / issuerId / keyPath が必要です。");
    }
    // keyPath は .asc.json からの相対でも絶対でも可。
    const kp = path.isAbsolute(c.keyPath) ? c.keyPath : path.join(HERE, c.keyPath);
    return { keyId: c.keyId, issuerId: c.issuerId, keyPath: kp };
  }
  throw new Error(
    "認証情報が未設定です。環境変数(ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH) か " +
      "scripts/asc/.asc.json を設定してください（README参照）。",
  );
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ASC 用 JWT（ES256, aud=appstoreconnect-v1, 有効20分）を生成。
function makeToken(cfg) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: cfg.keyId, typ: "JWT" };
  const payload = {
    iss: cfg.issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey(fs.readFileSync(cfg.keyPath));
  // ES256 は JOSE の raw(R||S) 形式が必要。DDR ではなく ieee-p1363 を指定。
  const sig = crypto.sign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64url(sig)}`;
}

// ---------- APIリクエスト ----------

async function api(method, endpoint, { token, query, body } = {}) {
  const url = new URL(endpoint.startsWith("http") ? endpoint : BASE + endpoint);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ctype = res.headers.get("content-type") || "";
  if (!res.ok) {
    let detail = buf.toString("utf8");
    try {
      detail = JSON.stringify(JSON.parse(detail), null, 2);
    } catch {
      /* テキストのまま */
    }
    throw new Error(`API ${res.status} ${res.statusText}\n${detail}`);
  }
  if (ctype.includes("application/json") || ctype.includes("vnd.api+json")) {
    return JSON.parse(buf.toString("utf8"));
  }
  return buf; // gz レポート等のバイナリ
}

// ---------- 出力ヘルパ ----------

function printRows(rows) {
  if (!rows.length) {
    console.log("(該当なし)");
    return;
  }
  for (const r of rows) console.log(r);
}

// ---------- コマンド ----------

const commands = {
  async token(cfg) {
    console.log(makeToken(cfg));
  },

  async apps(cfg) {
    const token = makeToken(cfg);
    const data = await api("GET", "/v1/apps", { token, query: { limit: "200" } });
    printRows(
      (data.data || []).map((a) => {
        const at = a.attributes || {};
        return `${a.id}\t${at.name}\t${at.bundleId}\t[${at.sku || ""}]`;
      }),
    );
  },

  async builds(cfg, appId) {
    if (!appId) throw new Error("使い方: builds <appId>");
    const token = makeToken(cfg);
    const data = await api("GET", "/v1/builds", {
      token,
      query: { "filter[app]": appId, limit: "50", sort: "-version" },
    });
    printRows(
      (data.data || []).map((b) => {
        const at = b.attributes || {};
        return `${b.id}\tv${at.version}\t${at.processingState}\t${at.uploadedDate || ""}`;
      }),
    );
  },

  async iaps(cfg, appId) {
    if (!appId) throw new Error("使い方: iaps <appId>");
    const token = makeToken(cfg);
    const data = await api("GET", `/v1/apps/${appId}/inAppPurchasesV2`, {
      token,
      query: { limit: "200" },
    });
    printRows(
      (data.data || []).map((p) => {
        const at = p.attributes || {};
        return `${p.id}\t${at.productId}\t${at.inAppPurchaseType}\t${at.state}\t${at.name}`;
      }),
    );
  },

  async subgroups(cfg, appId) {
    if (!appId) throw new Error("使い方: subgroups <appId>");
    const token = makeToken(cfg);
    const data = await api("GET", `/v1/apps/${appId}/subscriptionGroups`, {
      token,
      query: { limit: "200" },
    });
    printRows(
      (data.data || []).map((g) => `${g.id}\t${(g.attributes || {}).referenceName}`),
    );
  },

  async subs(cfg, groupId) {
    if (!groupId) throw new Error("使い方: subs <subscriptionGroupId>");
    const token = makeToken(cfg);
    const data = await api("GET", `/v1/subscriptionGroups/${groupId}/subscriptions`, {
      token,
      query: { limit: "200" },
    });
    printRows(
      (data.data || []).map((s) => {
        const at = s.attributes || {};
        return `${s.id}\t${at.productId}\t${at.state}\t${at.subscriptionPeriod || ""}\t${at.name}`;
      }),
    );
  },

  async get(cfg, endpoint, ...kv) {
    if (!endpoint) throw new Error("使い方: get <path> [key=value ...]");
    const token = makeToken(cfg);
    const query = Object.fromEntries(
      kv.map((pair) => {
        const i = pair.indexOf("=");
        return [pair.slice(0, i), pair.slice(i + 1)];
      }),
    );
    const data = await api("GET", endpoint, { token, query });
    console.log(JSON.stringify(data, null, 2));
  },

  async sales(cfg, vendorId) {
    if (!vendorId) throw new Error("使い方: sales <vendorNumber>");
    const token = makeToken(cfg);
    // 前日ぶんの日次サマリー（Appleは通常 前日以降が取得可能）。
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const report = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const gz = await api("GET", "/v1/salesReports", {
      token,
      query: {
        "filter[frequency]": "DAILY",
        "filter[reportType]": "SALES",
        "filter[reportSubType]": "SUMMARY",
        "filter[vendorNumber]": vendorId,
        "filter[reportDate]": report,
      },
    });
    const tsv = gunzipSync(gz).toString("utf8");
    const out = path.join(HERE, `sales-${report}.tsv`);
    fs.writeFileSync(out, tsv);
    console.log(`保存: ${out}\n---\n${tsv.split("\n").slice(0, 5).join("\n")}`);
  },

  async help() {
    console.log(HELP);
  },
};

const HELP = `App Store Connect API CLI

  node scripts/asc/asc.mjs token
  node scripts/asc/asc.mjs apps
  node scripts/asc/asc.mjs builds <appId>
  node scripts/asc/asc.mjs iaps <appId>
  node scripts/asc/asc.mjs subgroups <appId>
  node scripts/asc/asc.mjs subs <subscriptionGroupId>
  node scripts/asc/asc.mjs get <path> [key=value ...]
  node scripts/asc/asc.mjs sales <vendorNumber>

認証: 環境変数(ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH) か scripts/asc/.asc.json
`;

// ---------- エントリ ----------

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    console.log(HELP);
    return;
  }
  const fn = commands[cmd];
  if (!fn) {
    console.error(`不明なコマンド: ${cmd}\n`);
    console.log(HELP);
    process.exit(1);
  }
  // token/apps 等は cfg を第1引数に、以降にCLI引数を渡す。
  const cfg = cmd === "help" ? null : loadConfig();
  await fn(cfg, ...args);
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
