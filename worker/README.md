# Posture Analysis Proxy (Cloudflare Worker)

姿勢分析アプリのフロントエンドから呼ばれる薄いプロキシ。AIプロバイダー（Gemini/OpenAI/Anthropic）のAPIキーをWorkers Secretsに保管し、ブラウザにキーを露出させずにAPI呼び出しを中継します。

## デプロイ手順（初回のみ）

事前に [Cloudflareアカウント](https://dash.cloudflare.com/sign-up)（無料）が必要です。

```bash
cd worker
npm install
npx wrangler login          # ブラウザが開いてCloudflareログイン
npx wrangler secret put GEMINI_API_KEY     # 値を貼り付け
# 必要に応じて他のプロバイダーも：
# npx wrangler secret put OPENAI_API_KEY
# npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

`npx wrangler deploy` の出力に `https://posture-analysis-proxy.<your-subdomain>.workers.dev` のようなURLが表示されます。これをフロントエンドの設定に貼ります。

## ヘルスチェック

```bash
curl https://posture-analysis-proxy.<your-subdomain>.workers.dev/health
# => {"ok":true,"providers":["gemini","openai","anthropic"]}
```

## エンドポイント

`POST /api/findings`

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",   // 省略可（デフォルト適用）
  "system": "システムプロンプト",
  "user": "ユーザープロンプト（計測値JSONなど）"
}
```

レスポンス：
```json
{ "text": "AIからの応答テキスト（JSON文字列）" }
```

## レート制限

IPごとに 60秒で30リクエスト（Cloudflare Cache APIによるベストエフォート）。
モック用途には十分。本格運用では Cloudflare Rate Limiting Rules や Durable Objects に置き換えてください。

## CORS

`ALLOWED_ORIGIN` 環境変数で制限（デフォルトは GitHub Pages のURL）。
別オリジンから使う場合は `wrangler.toml` の `[vars]` を変更して再デプロイ。
