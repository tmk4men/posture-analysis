// AI client supporting two modes:
//   - "proxy"  : POST to a Cloudflare Worker that holds the API key (recommended for handover)
//   - "direct" : call the AI provider's API directly from the browser using the operator's own key
// Providers supported in both modes: gemini / openai / anthropic.
//
// The AI is responsible ONLY for the diagnosis narrative.  Muscle and exercise
// selections come from deterministic rules in src/pose/recommend.js so that
// different patients always produce visibly different reports.

const V = new URL(import.meta.url).search;
const recommendMod = await import("../pose/recommend.js" + V);
const { deriveRecommendations, summarizeIssues, painAreaLabels } = recommendMod;

const SYSTEM_PROMPT = `あなたは整骨院とジムが連携して使う姿勢分析レポートの「診断文」を作成するアシスタントです。

【入力】
- 渡される計測値は MediaPipe Pose Landmarker による推定値です。誤差を含みます。医学的診断は行いません。
- "detectedIssues" は、計測値そのものから自動抽出された姿勢上の所見の要約です（指標ごとに独立、姿勢パターン分類は行っていません）。
- "painAreas" は、患者本人が申告した不調・痛みの部位ラベルのリストです（任意）。空配列もありえます。
- 診断文は detectedIssues と painAreas の両方と矛盾しないように書いてください。

【出力ルール】
必ず以下の JSON フォーマットのみを返してください（説明文・コードフェンス禁止）。
{
  "diagnosis": "..."
}

diagnosis の要件：
- 患者に向けた平易な日本語で 3〜4文（合計 120〜180 文字程度）。
- detectedIssues に挙がっている所見を **必ず1〜2つ具体的に言及** する（例：「頭がやや前に出ています」「肩が前方に巻き込まれています」「左右の肩の高さに差があります」など）。**患者ごとに異なる所見**を選んで触れること。
- painAreas が入っている場合は、その不調部位に **必ず1つは触れる**（例：「ご申告の腰の不調に関連して…」「肩こりの背景には…」）。検出値と関連づけて自然に繋ぐこと。
- 検出された数値そのもの（"+12.3%" など）はレポート本文に出さず、患者向けの自然な表現に置き換える。
- 「猫背タイプ」「反り腰タイプ」のような姿勢分類ラベルは使わず、見られた特徴を素直に描写する（例：「背中が丸くなりやすい姿勢」「腰の反りが強めの姿勢」）。
- 影響の説明と、改善できる前向きな見通しを1文添える。
- 参考例「左右で肩の高さに差が見られ、頭もやや前方へ出やすい姿勢です。デスクワークなどで片側に負担が集中している可能性があります。週2回のトレーニングと、緊張した筋肉のストレッチを続けることで、徐々に整っていく見通しです。」

注意：
- 筋肉名やエクササイズ名は出力に含めないでください（別パイプラインで自動付与されます）。
- detectedIssues に何も挙がっていない場合は、理想姿勢に近い旨を伝えつつ、painAreas があればそれに触れた予防的助言を返してください。`;

const DEFAULT_MODELS = {
  gemini: "gemini-3.1-flash-lite",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

export function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] ?? "";
}

function buildUserPayload(patient, metricsByView, painAreas) {
  return {
    patient: {
      name: patient.name || null,
      date: patient.date || null,
    },
    metrics: metricsByView,
    detectedIssues: summarizeIssues(metricsByView),
    painAreas: painAreaLabels(painAreas),
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

function extractDiagnosis(parsed, rawText) {
  if (parsed && typeof parsed === "object" && typeof parsed.diagnosis === "string") {
    return parsed.diagnosis.trim();
  }
  // Fall back to the raw text if the AI returned plain prose instead of JSON.
  if (typeof rawText === "string" && rawText.trim()) {
    return rawText.trim().slice(0, 400);
  }
  return "";
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
    if (detail) throw new Error(detail);
    throw new Error(`プロキシエラー ${res.status}: ${await res.text()}`);
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
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
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
      temperature: 0.7,
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
      max_tokens: 2048,
      temperature: 0.7,
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
  const painAreas = patient.painAreas || [];

  // Deterministic picks happen regardless of AI availability.
  const rec = deriveRecommendations(metricsByView, painAreas);

  if (provider === "none") {
    return {
      findings: {
        diagnosis:
          "AI診断はオフです。計測値と申告された不調部位に基づき、推定した筋肉とトレーニングを表示しています。",
        ...rec,
      },
      raw: "AIプロバイダーが「使用しない」に設定されています。",
    };
  }

  const model = settings.model || DEFAULT_MODELS[provider];
  if (!model) throw new Error(`未対応のプロバイダー: ${provider}`);

  const userText = JSON.stringify(buildUserPayload(patient, metricsByView, painAreas), null, 2);

  let raw;
  try {
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
  } catch (err) {
    // AI failure should still produce a readable report — fall back to a
    // deterministic diagnosis stub plus the rule-based picks.
    const diagnosis = "AI診断文の生成に失敗したため、計測値ベースの推奨内容のみ表示しています。施術者の所見と合わせてご参照ください。";
    return { findings: { diagnosis, ...rec }, raw: `エラー: ${err.message}` };
  }

  const parsed = tryParseJson(raw);
  const diagnosis = extractDiagnosis(parsed, raw);

  return {
    findings: {
      diagnosis: diagnosis || "計測値に基づき、姿勢パターンから推定した筋肉とトレーニングを表示しています。",
      ...rec,
    },
    raw,
  };
}
