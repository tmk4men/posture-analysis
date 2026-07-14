#!/usr/bin/env node
// POSTURA 課金商品を一括セットアップ（App Store Connect API）。
//   - 月額サブスク（自動更新）＋ 無料トライアル
//   - 買い切り（非消耗）
// すべて冪等（既にあれば作らずスキップ）。既定はドライラン。実行は --yes。
//
// 使い方（Mac）:
//   node ~/postura/scripts/asc/setup-iap.mjs 6790814436          # 下見（作成しない）
//   node ~/postura/scripts/asc/setup-iap.mjs 6790814436 --yes    # 実際に作成
//
// 商品内容・価格は下の PLAN を編集すれば変えられる。

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ============ ここを編集すれば商品を調整できる ============
const PLAN = {
  territory: "JPN",
  locale: "ja",
  subscription: {
    groupRef: "Postura Pro",
    productId: "com.tomoki.postura.monthly",
    name: "月額プラン",
    period: "ONE_MONTH",
    targetYen: 800, // 近い価格ポイントを自動選択
    trialDuration: "ONE_WEEK", // 無料トライアル期間
    locName: "POSTURA 月額プラン",
    locDesc: "全機能を無制限に利用できます。",
  },
  lifetime: {
    productId: "com.tomoki.postura.lifetime",
    name: "買い切りプラン",
    targetYen: 2500,
    locName: "POSTURA 買い切り",
    locDesc: "追加の課金なしで、対象の全機能をご利用いただけます。",
  },
};
// =========================================================

const BASE = "https://api.appstoreconnect.apple.com";
const EXECUTE = process.argv.includes("--yes");
const appId = process.argv.find((a) => /^\d+$/.test(a));

// ---- 認証（asc.mjs と同じ探索） ----
function loadConfig() {
  if (process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID && process.env.ASC_KEY_PATH) {
    return {
      keyId: process.env.ASC_KEY_ID,
      issuerId: process.env.ASC_ISSUER_ID,
      keyPath: path.resolve(process.env.ASC_KEY_PATH),
    };
  }
  for (const f of [
    path.join(process.cwd(), ".asc.json"),
    path.join(os.homedir(), ".asc", "config.json"),
    path.join(os.homedir(), ".asc.json"),
  ]) {
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

function b64url(x) {
  return Buffer.from(x).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function token() {
  const cfg = loadConfig();
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId, typ: "JWT" }));
  const p = b64url(JSON.stringify({ iss: cfg.issuerId, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }));
  const key = crypto.createPrivateKey(fs.readFileSync(cfg.keyPath));
  const sig = crypto.sign("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" });
  return `${h}.${p}.${b64url(sig)}`;
}

const TOK = token();
async function api(method, endpoint, body) {
  const res = await fetch(BASE + endpoint, {
    method,
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = json?.errors?.map((e) => `${e.status} ${e.title}: ${e.detail}`).join("\n") || text;
    throw new Error(`${method} ${endpoint}\n${msg}`);
  }
  return json;
}

// ドライランの表示付き作成。既存なら作らない。
async function ensure(label, findFn, createBody, createPath) {
  const existing = await findFn();
  if (existing) {
    console.log(`  ✓ 既存: ${label} (${existing.id})`);
    return existing;
  }
  if (!EXECUTE) {
    console.log(`  ＋作成予定: ${label}`);
    return { id: `(dry-run)`, dryRun: true };
  }
  const res = await api("POST", createPath, createBody);
  console.log(`  ✅ 作成: ${label} (${res.data.id})`);
  return res.data;
}

async function main() {
  if (!appId) {
    console.error("使い方: node setup-iap.mjs <appId> [--yes]");
    process.exit(1);
  }
  console.log(`アプリ ${appId} の課金セットアップ ${EXECUTE ? "【実行】" : "【ドライラン：作成しません】"}\n`);
  const warnings = [];

  // ===== 1. サブスクグループ =====
  console.log("■ サブスクグループ");
  const group = await ensure(
    `group "${PLAN.subscription.groupRef}"`,
    async () => {
      const r = await api("GET", `/v1/apps/${appId}/subscriptionGroups?limit=200`);
      return (r.data || []).find((g) => g.attributes.referenceName === PLAN.subscription.groupRef);
    },
    {
      data: {
        type: "subscriptionGroups",
        attributes: { referenceName: PLAN.subscription.groupRef },
        relationships: { app: { data: { type: "apps", id: appId } } },
      },
    },
    "/v1/subscriptionGroups",
  );

  // ===== 2. 月額サブスク =====
  console.log("■ 月額サブスク");
  let sub = null;
  if (!group.dryRun) {
    const r = await api("GET", `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`);
    sub = (r.data || []).find((s) => s.attributes.productId === PLAN.subscription.productId);
  }
  sub = await ensure(
    `subscription ${PLAN.subscription.productId}`,
    async () => sub,
    {
      data: {
        type: "subscriptions",
        attributes: {
          name: PLAN.subscription.name,
          productId: PLAN.subscription.productId,
          subscriptionPeriod: PLAN.subscription.period,
          groupLevel: 1,
        },
        relationships: { group: { data: { type: "subscriptionGroups", id: group.id } } },
      },
    },
    "/v1/subscriptions",
  );

  // ===== 3. サブスクのローカライズ（日本語） =====
  if (!sub.dryRun) {
    console.log("■ サブスク表示名（ja）");
    await ensure(
      `subscription localization ja`,
      async () => {
        const r = await api("GET", `/v1/subscriptions/${sub.id}/subscriptionLocalizations?limit=50`);
        return (r.data || []).find((l) => l.attributes.locale === PLAN.locale);
      },
      {
        data: {
          type: "subscriptionLocalizations",
          attributes: { name: PLAN.subscription.locName, locale: PLAN.locale, description: PLAN.subscription.locDesc },
          relationships: { subscription: { data: { type: "subscriptions", id: sub.id } } },
        },
      },
      "/v1/subscriptionLocalizations",
    );

    // ===== 4-5. 価格＆無料トライアル（失敗しても止めずに続行） =====
    try {
      console.log("■ サブスク価格");
      const pp = await api(
        "GET",
        `/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=${PLAN.territory}&limit=200`,
      );
      const point = pickClosest(pp.data, PLAN.subscription.targetYen);
      if (!point) throw new Error("価格ポイントが取得できませんでした");
      console.log(`  対象価格ポイント: ¥${point.attributes.customerPrice} (${point.id})`);

      const hasPrice = (await api("GET", `/v1/subscriptions/${sub.id}/prices?limit=1`)).data?.length;
      if (hasPrice) console.log("  ✓ 既に価格設定あり");
      else if (!EXECUTE) console.log("  ＋価格設定予定");
      else {
        await api("POST", "/v1/subscriptionPrices", {
          data: {
            type: "subscriptionPrices",
            attributes: {},
            relationships: {
              subscription: { data: { type: "subscriptions", id: sub.id } },
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: point.id } },
            },
          },
        });
        console.log("  ✅ 価格設定");
      }

      console.log("■ 無料トライアル");
      const offers = await api("GET", `/v1/subscriptions/${sub.id}/introductoryOffers?limit=10`);
      if (offers.data?.length) console.log("  ✓ 既にトライアルあり");
      else if (!EXECUTE) console.log(`  ＋${PLAN.subscription.trialDuration} 無料トライアル作成予定`);
      else {
        await api("POST", "/v1/subscriptionIntroductoryOffers", {
          data: {
            type: "subscriptionIntroductoryOffers",
            attributes: { duration: PLAN.subscription.trialDuration, offerMode: "FREE_TRIAL", numberOfPeriods: 1 },
            relationships: {
              subscription: { data: { type: "subscriptions", id: sub.id } },
            },
          },
        });
        console.log("  ✅ 無料トライアル作成");
      }
    } catch (e) {
      warnings.push("サブスクの価格/トライアル（App Store Connect の画面で¥800とトライアル1週間を設定）");
      console.log("  ⚠ 価格/トライアルで停止: " + (e.message || e).split("\n").slice(-1)[0]);
      console.log("    → 構造は出来ています。価格だけ後で画面設定でもOK（数十秒）。続行します…");
    }
  }

  // ===== 6. 買い切り（非消耗） =====
  console.log("■ 買い切り（非消耗）");
  const iap = await ensure(
    `IAP ${PLAN.lifetime.productId}`,
    async () => {
      const r = await api("GET", `/v1/apps/${appId}/inAppPurchasesV2?limit=200`);
      return (r.data || []).find((p) => p.attributes.productId === PLAN.lifetime.productId);
    },
    {
      data: {
        type: "inAppPurchases",
        attributes: { name: PLAN.lifetime.name, productId: PLAN.lifetime.productId, inAppPurchaseType: "NON_CONSUMABLE" },
        relationships: { app: { data: { type: "apps", id: appId } } },
      },
    },
    "/v2/inAppPurchases",
  );

  if (!iap.dryRun) {
    console.log("■ 買い切り表示名（ja）");
    // GET の関係パスが弾かれるので、直接POSTして重複はエラーで判定する。
    try {
      await api("POST", "/v1/inAppPurchaseLocalizations", {
        data: {
          type: "inAppPurchaseLocalizations",
          attributes: { locale: PLAN.locale, name: PLAN.lifetime.locName, description: PLAN.lifetime.locDesc },
          relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: iap.id } } },
        },
      });
      console.log("  ✅ 作成: IAP localization ja");
    } catch (e) {
      const m = (e.message || "").toString();
      if (/already|duplicate|409/i.test(m)) console.log("  ✓ 既存: IAP localization ja");
      else {
        warnings.push("買い切りの表示名(ja)（画面で設定）");
        console.log("  ⚠ 表示名で停止: " + m.split("\n").slice(-1)[0]);
      }
    }
    // 買い切りの価格（価格スケジュール）
    try {
      console.log("■ 買い切り価格");
      const pp = await api(
        "GET",
        `/v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=${PLAN.territory}&limit=200`,
      );
      const point = pickClosest(pp.data, PLAN.lifetime.targetYen);
      if (!point) throw new Error("買い切りの価格ポイントが取得できません");
      console.log(`  対象価格ポイント: ¥${point.attributes.customerPrice}`);
      if (!EXECUTE) console.log("  ＋価格設定予定");
      else {
        await api("POST", "/v1/inAppPurchasePriceSchedules", {
          data: {
            type: "inAppPurchasePriceSchedules",
            relationships: {
              inAppPurchase: { data: { type: "inAppPurchases", id: iap.id } },
              manualPrices: { data: [{ type: "inAppPurchasePrices", id: "${price}" }] },
              baseTerritory: { data: { type: "territories", id: PLAN.territory } },
            },
          },
          included: [
            {
              type: "inAppPurchasePrices",
              id: "${price}",
              attributes: { startDate: null },
              relationships: {
                inAppPurchasePricePoint: {
                  data: { type: "inAppPurchasePricePoints", id: point.id },
                },
              },
            },
          ],
        });
        console.log("  ✅ 買い切り価格設定");
      }
    } catch (e) {
      const m = (e.message || "").toString();
      if (/already|exist/i.test(m)) console.log("  ✓ 既に価格設定あり");
      else {
        warnings.push("買い切りの価格（画面で¥2,500を設定）");
        console.log("  ⚠ 買い切り価格で停止: " + m.split("\n").slice(-1)[0]);
      }
    }
  }

  if (warnings.length) {
    console.log("\n― 画面で仕上げが必要な項目 ―");
    warnings.forEach((w) => console.log("  ・" + w));
  }
  console.log(`\n${EXECUTE ? "完了。" : "ドライラン完了。問題なければ --yes を付けて再実行してください。"}`);
}

function pickClosest(points, targetYen) {
  if (!points?.length) return null;
  return points
    .map((p) => ({ p, diff: Math.abs(Number(p.attributes.customerPrice) - targetYen) }))
    .sort((a, b) => a.diff - b.diff)[0].p;
}

main().catch((e) => {
  console.error("\n[エラー] " + (e.message || e));
  console.error("※ 冪等なので、原因を直して同じコマンドを再実行すれば続きから進みます。");
  process.exit(1);
});
