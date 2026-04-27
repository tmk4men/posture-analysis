// AI client supporting two modes:
//   - "proxy"  : POST to a Cloudflare Worker that holds the API key (recommended for handover)
//   - "direct" : call the AI provider's API directly from the browser using the operator's own key
// Providers supported in both modes: gemini / openai / anthropic.

const SYSTEM_PROMPT = `あなたは整骨院の姿勢分析アシスタントです。
- 渡される計測値（角度・左右差）は MediaPipe Pose Landmarker による推定値です。誤差を含む可能性があります。
- 医学的診断は行いません。観察された姿勢の傾向と、一般的に推奨されるセルフケアを患者向けの平易な日本語で述べてください。
- 出力は必ず以下の JSON フォーマットだけを返してください（説明文・コードフェンスは禁止）。
{
  "observations": ["..."],
  "implications": ["..."],
  "selfcare": ["..."],
  "notes": "..."
}
- observations: 計測値から読み取れる姿勢の特徴を3〜5項目
- implications: 放置した場合に起こりうる身体的影響の可能性を3項目以内
- selfcare: 自宅でできる簡単なストレッチや姿勢意識のポイントを3項目
- notes: 施術者への申し送りや注意点を1〜2文（不要なら空文字）`;

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

export function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] ?? "";
}

function buildUserPayload(patient, metricsByView) {
  return {
    patient: {
      name: patient.name || null,
      date: patient.date || null,
    },
    metrics: metricsByView,
    閾値の目安: {
      肩の傾き: "±2° 以上で左右差あり",
      骨盤の傾き: "±2° 以上で左右差あり",
      頭部前方位: "+10% 以上で前方変位の傾向",
      肩の前方変位: "+8% 以上で巻き肩傾向",
    },
  };
}

function tryParseJson(text) {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

// ---- Proxy mode --------------------------------------------------------

async function callProxy({ proxyUrl, provider, model, system, user }) {
  const url = proxyUrl.replace(/\/$/, "") + "/api/findings";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, system, user }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch {}
    throw new Error(`プロキシエラー ${res.status}: ${detail || (await res.text())}`);
  }
  const data = await res.json();
  return data.text ?? "";
}

// ---- Direct mode -------------------------------------------------------

async function callGemini({ model, apiKey, system, user }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
}

async function callOpenAI({ model, apiKey, system, user }) {
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
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic({ model, apiKey, system, user }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

// ---- Public entry ------------------------------------------------------

export async function generateFindings(settings, patient, metricsByView) {
  const { mode, provider } = settings;
  if (provider === "none") {
    return { findings: null, raw: "AIプロバイダーが「使用しない」に設定されています。計測値のみを参照してください。" };
  }
  const model = settings.model || DEFAULT_MODELS[provider];
  if (!model) throw new Error(`未対応のプロバイダー: ${provider}`);

  const userText = JSON.stringify(buildUserPayload(patient, metricsByView), null, 2);

  let raw;
  if (mode === "proxy") {
    if (!settings.proxyUrl) {
      throw new Error("プロキシURLが未設定です。「設定」で接続方法を確認してください。");
    }
    raw = await callProxy({
      proxyUrl: settings.proxyUrl,
      provider,
      model,
      system: SYSTEM_PROMPT,
      user: userText,
    });
  } else {
    if (!settings.apiKey) {
      throw new Error("APIキーが未設定です。「設定」から登録するか、接続方法を「プロキシ経由」にしてください。");
    }
    if (provider === "gemini") {
      raw = await callGemini({ model, apiKey: settings.apiKey, system: SYSTEM_PROMPT, user: userText });
    } else if (provider === "openai") {
      raw = await callOpenAI({ model, apiKey: settings.apiKey, system: SYSTEM_PROMPT, user: userText });
    } else if (provider === "anthropic") {
      raw = await callAnthropic({ model, apiKey: settings.apiKey, system: SYSTEM_PROMPT, user: userText });
    } else {
      throw new Error(`未対応のプロバイダー: ${provider}`);
    }
  }

  return { findings: tryParseJson(raw), raw };
}
