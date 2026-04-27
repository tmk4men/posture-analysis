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

async function callGemini({ model, system, user, env }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured on the worker");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function callOpenAI({ model, system, user, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured on the worker");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic({ model, system, user, env }) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured on the worker");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
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
      return json(502, { error: err.message }, env);
    }
  },
};
