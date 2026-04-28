// Cloudflare Worker that proxies AI provider calls so the API key never reaches the browser.
// Routes:
//   POST /api/findings         { provider, model, system, user } -> { text }
// Env (set via `wrangler secret put`):
//   GEMINI_API_KEY     (optional, required only if Gemini is selected)
//   OPENAI_API_KEY     (optional)
//   ANTHROPIC_API_KEY  (optional)
//   ALLOWED_ORIGIN     (e.g. "https://tmk4men.github.io")
//
// Rate limit: per-IP 30 req/min via Cloudflare Cache hack (best-effort, not bulletproof but enough for a mock).

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(status, body, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env),
    },
  });
}

async function checkRateLimit(request, env) {
  // Best-effort per-IP rate limit: 30 requests / 60 seconds.
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";
  const bucket = Math.floor(Date.now() / 60_000);
  const cacheKey = new Request(`https://ratelimit.local/${encodeURIComponent(ip)}/${bucket}`);
  const cache = caches.default;
  let res = await cache.match(cacheKey);
  let count = 0;
  if (res) count = parseInt(await res.text(), 10) || 0;
  count += 1;
  if (count > 30) return false;
  await cache.put(
    cacheKey,
    new Response(String(count), { headers: { "Cache-Control": "max-age=70" } })
  );
  return true;
}

// Retry transient upstream failures: 408 / 429 / 500 / 502 / 503 / 504.
// 3 attempts total, exponential backoff (~500ms, ~1500ms) with jitter.
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

class UpstreamError extends Error {
  constructor(provider, status, body) {
    super(`${provider} ${status}: ${body}`);
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

async function fetchWithRetry(provider, url, init) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const text = await res.text();
      lastErr = new UpstreamError(provider, res.status, text);
      if (!RETRYABLE_STATUSES.has(res.status)) throw lastErr;
    } catch (err) {
      lastErr = err instanceof UpstreamError ? err : new UpstreamError(provider, 0, err.message);
      if (err instanceof UpstreamError && !RETRYABLE_STATUSES.has(err.status)) throw err;
    }
    if (attempt < 2) {
      const delay = 500 * Math.pow(3, attempt) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function callGemini({ model, system, user, env }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured on the worker");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithRetry("Gemini", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function callOpenAI({ model, system, user, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured on the worker");
  const res = await fetchWithRetry("OpenAI", "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic({ model, system, user, env }) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured on the worker");
  const res = await fetchWithRetry("Anthropic", "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

function toFriendlyMessage(err) {
  if (err instanceof UpstreamError) {
    if (err.status === 503 || err.status === 502 || err.status === 504) {
      return "AIサービスが現在混雑しています。1〜2分ほど待ってから、もう一度お試しください。";
    }
    if (err.status === 429) {
      return "AIサービスの利用制限に達しました。しばらく待ってから再度お試しください。";
    }
    if (err.status === 401 || err.status === 403) {
      return "AI接続の認証に失敗しました。管理者にAPIキーの設定をご確認ください。";
    }
    if (err.status === 400) {
      return "AIへのリクエスト内容に問題がありました。設定のモデル名をご確認ください。";
    }
    if (err.status >= 500) {
      return "AIサービス側で一時的なエラーが発生しました。少し待って再度お試しください。";
    }
  }
  return err.message || "AI生成中に予期しないエラーが発生しました。";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json(200, { ok: true, providers: Object.keys(DEFAULT_MODELS) }, env);
    }

    if (url.pathname !== "/api/findings" || request.method !== "POST") {
      return json(404, { error: "Not Found" }, env);
    }

    const allowed = await checkRateLimit(request, env);
    if (!allowed) return json(429, { error: "Rate limit exceeded (30 req/min/IP)" }, env);

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON body" }, env);
    }

    const { provider, system, user } = body;
    const model = body.model || DEFAULT_MODELS[provider];
    if (!provider || !system || !user) {
      return json(400, { error: "provider, system, user are required" }, env);
    }
    if (!DEFAULT_MODELS[provider]) {
      return json(400, { error: `Unsupported provider: ${provider}` }, env);
    }

    try {
      let text;
      if (provider === "gemini") text = await callGemini({ model, system, user, env });
      else if (provider === "openai") text = await callOpenAI({ model, system, user, env });
      else if (provider === "anthropic") text = await callAnthropic({ model, system, user, env });
      return json(200, { text }, env);
    } catch (err) {
      const status = err instanceof UpstreamError ? err.status || 502 : 502;
      return json(status, { error: toFriendlyMessage(err) }, env);
    }
  },
};
