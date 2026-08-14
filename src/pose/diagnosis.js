// 所見文（diagnosis）のルールベース自動生成。
//
// 以前は外部AI（Gemini / OpenAI / Anthropic）に計測値を渡して文章を書かせて
// いたが、これを廃止し、計測値・申告部位・週頻度から決定的にテンプレートを
// 組み立てるルールエンジンに置き換えた。同じ入力は必ず同じ文章を返す。
//
// 文章の設計方針（DIAGNOSIS_RULEBOOK.md と対応）：
//   - 患者向けの平易な日本語で 3〜4 文（およそ 120〜180 字）。
//   - 数値（"+12.3%" 等）は本文に出さない。「やや」「はっきりと」等の度合い語に変換。
//   - 「猫背タイプ」等の分類ラベルは使わない。見えた特徴をそのまま描写。
//   - 医療的・診断的な語（診断／所見／症状 等）は避け、生活者向けアプリの語り口にする。
//   - 申告された不調部位があれば必ず1つ触れる。
//   - 最後に週N回の頻度を反映した前向きな見通しを添える。

import { WARN, KNEE, ENTRY_RATIO, getMetric } from "./thresholds.js?v=20260814-1548";

function clampFrequency(weeklyFrequency) {
  return Math.min(5, Math.max(1, parseInt(weeklyFrequency, 10) || 2));
}

function frequencyLabel(freq) {
  return freq >= 5 ? "週5回以上" : `週${freq}回`;
}

// 逸脱の大きさ（= |計測値| / しきい値）を度合い語に変換する。
//   0.5〜1.0 … わずかに   1.0〜2.0 … やや   2.0〜 … はっきりと
function severityWord(ratio) {
  if (ratio >= 2) return "はっきりと";
  if (ratio >= 1) return "やや";
  return "わずかに";
}

// ---- 計測値 → 所見候補 -------------------------------------------------
//
// 各エントリは { ratio, priority, plane, build(adv) } を持つ。
//   ratio    … 逸脱の大きさ。大きいほど主所見として優先。
//   priority … ratio 同点時の安定ソート用の固定順位。
//   plane    … 'sagittal'（側面写真＝前後の崩れ）/ 'frontal'（正面写真＝左右差）。
//              副所見をどちらから選ぶかの判断に使う。
//   build    … 度合い語 adv を受け取り { desc, impact } を返す関数。
//              desc   … 「〜な姿勢」「〜なクセ」で終わる特徴の描写（名詞句）。
//              impact … その特徴が日常でどう影響しやすいかの一文。
function collectFindings(byView) {
  const out = [];
  const side = byView?.right ? "right" : byView?.left ? "left" : null;
  let plane = "sagittal";
  const push = (ratio, priority, build) => out.push({ ratio, priority, plane, build });

  // ===== 側面ビュー（右優先） =====
  if (side) {
    const fh = getMetric(byView, side, "forward_head");
    if (fh && Math.abs(fh.value) / WARN.forward_head >= ENTRY_RATIO) {
      const ratio = Math.abs(fh.value) / WARN.forward_head;
      push(ratio, 1, (adv) =>
        fh.value >= 0
          ? {
              desc: `${adv}頭が肩より前に出やすい姿勢`,
              impact:
                "スマホやパソコンを見る時間が長い方に多く、首すじや肩の上のあたりが疲れやすくなります。",
            }
          : {
              desc: `${adv}頭が後ろぎみに引けた姿勢`,
              impact:
                "首の後ろがつまりやすく、上を向く動きがしにくく感じることがあります。",
            });
    }

    const sf = getMetric(byView, side, "shoulder_forward");
    if (sf && Math.abs(sf.value) / WARN.shoulder_forward >= ENTRY_RATIO) {
      const ratio = Math.abs(sf.value) / WARN.shoulder_forward;
      push(ratio, 2, (adv) =>
        sf.value >= 0
          ? {
              desc: `${adv}肩が内側に巻き込まれやすい姿勢（いわゆる巻き肩）`,
              impact:
                "胸の前が縮こまって背中側が伸ばされ、肩まわりが動かしにくく感じやすくなります。",
            }
          : {
              desc: `${adv}肩が後ろぎみに引けた姿勢`,
              impact:
                "胸を張った状態が続きやすく、肩や背中の上のあたりが張りやすくなります。",
            });
    }

    const tr = getMetric(byView, side, "trunk_lean");
    if (tr && Math.abs(tr.value) / WARN.trunk_lean >= ENTRY_RATIO) {
      const ratio = Math.abs(tr.value) / WARN.trunk_lean;
      push(ratio, 3, (adv) =>
        tr.value >= 0
          ? {
              desc: `${adv}上半身が前に傾きやすい姿勢`,
              impact:
                "腰や背中で体を支える時間が長くなり、腰まわりが張りやすくなります。",
            }
          : {
              desc: `${adv}上半身が後ろに傾きやすい姿勢`,
              impact:
                "背中を丸めてバランスを取りやすく、背中や腰の張りにつながることがあります。",
            });
    }

    const kn = getMetric(byView, side, "knee_angle");
    if (kn) {
      if (kn.value >= KNEE.hyper) {
        const ratio = (kn.value - KNEE.hyper) / WARN.knee_hyper + 1;
        push(ratio, 4, (adv) => ({
          desc: `${adv}立つときに膝が後ろへ反りやすいクセ`,
          impact:
            "膝の裏やふくらはぎに力が入り続けやすく、脚が疲れやすくなります。",
        }));
      } else if (kn.value < KNEE.flex) {
        const ratio = (KNEE.flex - kn.value) / WARN.knee_flex + 1;
        push(ratio, 4, (adv) => ({
          desc: `${adv}膝を軽く曲げたまま立つクセ`,
          impact:
            "太ももの前や膝まわりがつねに働きやすく、脚が疲れやすくなります。",
        }));
      }
    }
  }

  // ===== 正面ビュー =====
  plane = "frontal";
  if (byView?.front && byView.front.length) {
    const st = getMetric(byView, "front", "shoulder_tilt");
    if (st && Math.abs(st.value) / WARN.shoulder_tilt >= ENTRY_RATIO) {
      const ratio = Math.abs(st.value) / WARN.shoulder_tilt;
      const low = st.value > 0 ? "右" : "左"; // value>0 = 右肩が下がり
      push(ratio, 5, (adv) => ({
        desc: `${adv}左右の肩の高さに差が出やすい姿勢（${low}肩が下がりぎみ）`,
        impact:
          "左右どちらかの肩や首まわりに力が偏りやすく、肩の張りに左右差が出やすくなります。",
      }));
    }

    const pt = getMetric(byView, "front", "pelvic_tilt");
    if (pt && Math.abs(pt.value) / WARN.pelvic_tilt >= ENTRY_RATIO) {
      const ratio = Math.abs(pt.value) / WARN.pelvic_tilt;
      const low = pt.value > 0 ? "右" : "左"; // value>0 = 右骨盤が下がり
      push(ratio, 6, (adv) => ({
        desc: `${adv}骨盤の高さに左右差が出やすい姿勢（${low}側が下がりぎみ）`,
        impact:
          "腰や股関節まわりの働きに左右差が出て、腰の片側が張りやすくなります。",
      }));
    }

    const ht = getMetric(byView, "front", "head_tilt");
    if (ht && Math.abs(ht.value) / WARN.head_tilt >= ENTRY_RATIO) {
      const ratio = Math.abs(ht.value) / WARN.head_tilt;
      const to = ht.value > 0 ? "右" : "左"; // value>0 = 右へ傾斜
      push(ratio, 7, (adv) => ({
        desc: `${adv}頭が${to}側にかたむきやすい姿勢`,
        impact: `首の${to}側が緊張しやすく、首すじの張りにつながることがあります。`,
      }));
    }

    const ls = getMetric(byView, "front", "lateral_shift");
    if (ls && Math.abs(ls.value) / WARN.lateral_shift >= ENTRY_RATIO) {
      const ratio = Math.abs(ls.value) / WARN.lateral_shift;
      const to = ls.value > 0 ? "右" : "左"; // value>0 = 右へシフト
      push(ratio, 8, (adv) => ({
        desc: `${adv}上半身の中心が${to}側へずれやすい姿勢`,
        impact:
          "体の左右で支える力に差が出て、腰や骨盤まわりのバランスがかたよりやすくなります。",
      }));
    }
  }

  // ratio 降順 → 同点は priority 昇順で安定ソート。
  out.sort((a, b) => b.ratio - a.ratio || a.priority - b.priority);
  return out;
}

// ---- 申告された不調部位 → 一文 -----------------------------------------
// 医療的な断定は避け、「〜とも関わりやすい姿勢です」と柔らかくつなぐ。
const PAIN_SENTENCE = {
  neck: "気になっている首まわりのハリとも、関わりやすい姿勢です。",
  shoulder: "気になっている肩まわりのハリとも、つながりやすい姿勢です。",
  midback: "気になっている背中のハリとも、関わりやすい姿勢です。",
  lowback: "気になっている腰まわりのハリとも、関わりやすい姿勢です。",
  hip: "気になっている股関節まわりの感覚とも、関わりやすい姿勢です。",
  knee: "気になっている膝まわりの感覚とも、関わりやすい姿勢です。",
  calf: "気になっているふくらはぎのハリとも、関わりやすい姿勢です。",
  thigh_front: "気になっている太もも前のハリとも、関わりやすい姿勢です。",
  thigh_back: "気になっている太もも裏のハリとも、関わりやすい姿勢です。",
};

// 申告部位のうち、最初に対応表に載っているものの一文を返す（無ければ null）。
function firstPainSentence(painAreas) {
  if (!Array.isArray(painAreas)) return null;
  for (const id of painAreas) {
    if (PAIN_SENTENCE[id]) return PAIN_SENTENCE[id];
  }
  return null;
}

function outlookSentence(freqLabel) {
  return `${freqLabel}のトレーニングと、こわばった筋肉のストレッチを続けることで、少しずつ整えていけます。`;
}

// ---- 公開エントリ ------------------------------------------------------
// 計測値・申告部位・週頻度から所見文（文字列）を組み立てる。
export function buildDiagnosis(metricsByView, painAreas = [], weeklyFrequency = 2) {
  const freq = clampFrequency(weeklyFrequency);
  const freqLabel = frequencyLabel(freq);
  const findings = collectFindings(metricsByView);
  const painSentence = firstPainSentence(painAreas);

  // --- 逸脱が拾えなかった場合：理想姿勢に近い旨＋予防的な前向き文 ---
  if (!findings.length) {
    const parts = ["大きな姿勢の崩れは見られず、全体にバランスの取れた状態です。"];
    if (painSentence) parts.push(painSentence);
    parts.push(
      `${freqLabel}のトレーニングとストレッチで、今の良い状態をキープしていきましょう。`,
    );
    return parts.join("");
  }

  // --- 主所見（最大逸脱）を度合い語つきで描写 ---
  const top = findings[0];
  const topBuilt = top.build(severityWord(top.ratio));

  // 副所見は「主所見と違う面」から優先して選ぶ。
  // 正面（左右差）と側面（前後の崩れ）は別々の写真から出る別の話なので、
  // 単純な ratio 順だと片方の写真の所見が2件とも占めて、
  // もう一方の写真で見えている崩れ（猫背・巻き肩など）が一度も触れられない。
  // 反対の面に採用済みの所見があればそれを、無ければ従来どおり ratio 2位を使う。
  const secondEntry =
    findings.slice(1).find((f) => f.plane !== top.plane) ?? findings[1];

  // 第1文：所見が2件以上あれば副所見を短く併記、1件ならそのまま。
  let sentence1;
  if (secondEntry) {
    const second = secondEntry.build(""); // 副所見は度合い語なしで簡潔に
    sentence1 = `${topBuilt.desc}に加えて、${second.desc}も見られます。`;
  } else {
    sentence1 = `${topBuilt.desc}です。`;
  }

  // 第2文：主所見の日常への影響。
  const parts = [sentence1, topBuilt.impact];

  // 第3文（任意）：申告された不調部位に触れる。
  if (painSentence) parts.push(painSentence);

  // 最終文：週頻度を反映した前向きな見通し。
  parts.push(outlookSentence(freqLabel));

  return parts.join("");
}
