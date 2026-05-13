// AI client supporting two modes:
//   - "proxy"  : POST to a Cloudflare Worker that holds the API key (recommended for handover)
//   - "direct" : call the AI provider's API directly from the browser using the operator's own key
// Providers supported in both modes: gemini / openai / anthropic.

const V = new URL(import.meta.url).search;
const [musclesMod, machinesMod] = await Promise.all([
  import("../data/muscles.js" + V),
  import("../data/machines.js" + V),
]);
const { MUSCLES, muscleIds } = musclesMod;
const { MACHINES, machineIds } = machinesMod;

const MUSCLE_TABLE = MUSCLES.map(
  (m) => `- id: "${m.id}"  label: "${m.label}"  side: ${m.side}`
).join("\n");

const MACHINE_TABLE = MACHINES.map(
  (m) => `- id: "${m.id}"  label: "${m.label}"  対象: ${m.targets.join("/")}`
).join("\n");

const SYSTEM_PROMPT = `あなたは整骨院とジムが連携して使う姿勢分析レポートを作成するアシスタントです。

【入力】
渡される計測値は MediaPipe Pose Landmarker による推定値です。誤差を含みます。医学的診断は行いません。

【出力ルール】
必ず以下の JSON フォーマットのみを返してください（説明文・コードフェンス禁止）。
{
  "diagnosis": "...",
  "weakMuscles": [ { "id": "...", "note": "..." } ],
  "tightMuscles": [ { "id": "...", "note": "..." } ],
  "trainingPlan": [
    { "machineId": "...", "purpose": "...", "sets": "...", "reps": "...", "points": ["..."] }
  ]
}

各フィールド要件：
- diagnosis: 計測値から読み取れる姿勢の特徴と影響を、患者向けに平易な日本語で 3〜4文。参考例「この方は、頭がやや前に出やすく、首の前傾や肩の巻き込み、背中の丸まり傾向が見られます。…」
- weakMuscles: 鍛えるべき筋肉。下記筋肉カタログの id から 2〜5個 選択。note には「なぜ弱化しているか／鍛える狙い」を15文字程度。
- tightMuscles: ほぐすべき筋肉。同じく id から 2〜5個 選択。note には「なぜ硬くなっているか／ほぐす狙い」を15文字程度。
- trainingPlan: 必ず ちょうど4種目。下記マシンカタログの id から選択。週2回固定で実施する前提。
  - purpose: そのマシンを採用する狙い（例「肩甲骨を寄せる」「体幹安定」）
  - sets: 例「10回 × 2セット」
  - reps: 例「軽い重さでOK」など補足。空文字でも可。
  - points: 運動のポイントを2〜3個、簡潔に。

【利用可能な筋肉カタログ（idと部位）】
${MUSCLE_TABLE}

【利用可能なマシンカタログ（id・名称・対象部位）】
${MACHINE_TABLE}

注意：
- 筋肉idは weakMuscles と tightMuscles で重複させない。
- マシンidは trainingPlan 内で重複させない。
- 計測値が乏しい場合でも、典型的な姿勢パターンから一般的な推奨を返してください。`;

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

// Normalise AI output and drop entries whose id is not in the catalogue.
function sanitizeFindings(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const validMuscleIds = new Set(muscleIds());
  const validMachineIds = new Set(machineIds());

  const filterMuscles = (arr) =>
    Array.isArray(arr)
      ? arr
          .filter((x) => x && typeof x.id === "string" && validMuscleIds.has(x.id))
          .map((x) => ({ id: x.id, note: String(x.note ?? "") }))
      : [];

  const trainingPlan = Array.isArray(parsed.trainingPlan)
    ? parsed.trainingPlan
        .filter((x) => x && typeof x.machineId === "string" && validMachineIds.has(x.machineId))
        .map((x) => ({
          machineId: x.machineId,
          purpose: String(x.purpose ?? ""),
          sets: String(x.sets ?? ""),
          reps: String(x.reps ?? ""),
          points: Array.isArray(x.points) ? x.points.map(String).slice(0, 4) : [],
        }))
    : [];

  return {
    diagnosis: String(parsed.diagnosis ?? ""),
    weakMuscles: filterMuscles(parsed.weakMuscles),
    tightMuscles: filterMuscles(parsed.tightMuscles),
    trainingPlan,
  };
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
      max_tokens: 2048,
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

  const parsed = tryParseJson(raw);
  const findings = sanitizeFindings(parsed);
  return { findings, raw };
}
