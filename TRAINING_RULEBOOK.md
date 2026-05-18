# 姿勢改善トレーニング 処方ルールブック

POSTURA Studio で出力する個別トレーニング表の「回数 × セット数」決定ルールです。来院回数（週1〜5回）に応じて1種目あたりの負荷量を変えます。**設計はすべて公開エビデンスに基づき、姿勢矯正/コレクティブエクササイズ文脈に整合しています。**

## 設計思想（3行）

1. **週間総量（weekly volume）が成果を決める** — 1セッションの量ではなく週合計の刺激が筋・可動域の変化を生む（Schoenfeld 2017、ACSM 2026）。
2. **来院回数が増えるほど1回あたりは軽くし、週総量を最適域に収める** — 高頻度で1回ガッツリやると過負荷・離脱の原因になる。
3. **姿勢改善 = 持久・安定系の刺激** — 高重量低回数ではなく、**中等度負荷 × 10〜15回 × 複数セット**が標準（NASM コレクティブエクササイズ／ACSM）。

## 処方表（全種目共通：回数×セット）

| 来院頻度 | 強化系 | ストレッチ系（ラクレッチ等） | セット間休憩 |
|:--:|:--:|:--:|:--:|
| 週1回 | **15回 × 3セット** | **15回 × 3セット** | 60秒 |
| 週2回 | **12回 × 3セット** | **12回 × 3セット** | 60秒 |
| 週3回 | **12回 × 2セット** | **12回 × 2セット** | 60秒 |
| 週4回 | **10回 × 2セット** | **10回 × 2セット** | 45〜60秒 |
| 週5回以上 | **10回 × 2セット** | **10回 × 2セット** | 45秒 |

**強化系の強度目安**：最後の1〜2回がややきつく感じる重さ（**RIR 2〜3 = あと2〜3回できる余裕で止める**）。失敗するまで追い込まない（ACSM 2026 推奨）。

**ストレッチ系の強度目安**：**痛みのない範囲で、軽度〜中等度の伸張感**を感じる可動域。反動はつけず、1回あたり3〜5秒かけてゆっくり押し/引きを行う（≒ 1セットで45〜60秒の累積ストレッチ時間に相当、Arntz 2024 の有効領域内）。

## なぜこの数字か（根拠）

### 強化系

- **レップ数 10〜15回**：NASMコレクティブエクササイズ／姿勢改善プロトコルで標準。姿勢を支える深層・遅筋繊維中心の筋群（深頸屈筋、下部僧帽筋、肩甲骨周囲、内腹斜筋、中臀筋など）は持久系刺激に応答しやすい。低レップ高重量は不要、むしろ代償動作のリスクが上がる。
- **セット数**：ACSM 2026 が推奨する「最低1種目2セット」を基準に、低頻度ほど1回あたりのセットを増やして週総量を担保。
- **週総セット数**：Schoenfeld 2017 メタ解析で「週10セット/筋群以上」が「5セット未満」より有意に優位。週4〜5回コースで週8〜10セットに達し、推奨域に乗る。週1〜2回は理論上の最適には届かないが、姿勢改善（=最大筋肥大ではなく機能改善）目的では十分に機能する量。
- **RIR（Reps in Reserve）2〜3**：ACSM 2026 が明示。失敗まで追い込むより、軽い余裕を残す方が継続性・安全性が高く、成果も同等。

### ストレッチ系（ラクレッチ等のマシン式）

- **マシン式ストレッチは反復動作**：患者がレバーやハンドルで対象筋を周期的に伸ばす器具。1レップ ≒ 3〜5秒の動的伸張に相当するため、**「回数 × セット」表記が現場の操作感と一致**する。
- **1セット あたりの累積伸張時間**：12〜15回 × 約4秒 = **約45〜60秒/セット**。2024年メタ解析（Arntz et al., n=189件）の「30〜60秒は15秒より有意に優位」ゾーンに入る。
- **週総量の上限**：同メタ解析で「セッション4分・週10分を超えると追加効果なし」。本ルールは週総量を約2〜4分/筋に収め、有効域に入りつつ過剰を避ける。
- **頻度の影響は小さい**：同メタ解析で「週間頻度は効果を有意に左右しない」=ストレッチは1〜2回でも週総量が確保できれば効果は出る。
- **15秒未満の動的ストレッチは効果限定**：1回あたり3秒以下にならないよう、ゆっくり動かす指導を併用する。

## AI/プログラム実装ガイド

`src/data/exerciseAssets.js` の各種目は `strengthens` か `stretches` のどちらかにIDが入っている。この分類で強化/ストレッチを判定し、上記表のセル値を引いて出力する。

```js
// 想定実装イメージ（強化・ストレッチとも同じ数字に統一）
const PRESCRIPTION = {
  1: { reps: 15, sets: 3 },
  2: { reps: 12, sets: 3 },
  3: { reps: 12, sets: 2 },
  4: { reps: 10, sets: 2 },
  5: { reps: 10, sets: 2 },
};
```

カードへの表示文字列は全種目「12回 × 3セット」のような **回数 × セット** 形式に統一。既存画像（週2回基準で焼き込み済み）の表記様式と整合する。

## 注意・除外事項

- 本ルールは **健常成人** を想定。急性疼痛・術後早期・重度の関節可動域制限がある場合は、現場での個別判断を優先（柔整師による減量・回数減を許容）。
- 70歳以上、長期離脱者、運動未経験者は **「週1回」相当の処方から開始** することを推奨（ACSM Older Adults Position Stand 整合）。
- 「週5回以上」は習慣化目的の頻度。負荷量は週4回と同等に抑え、過負荷を避ける。
- 痛みが出た場合、当該種目は中断し施術者に確認するよう、出力レポート上で明示する（現行フッターで対応済み）。

## 参考文献

- ACSM Position Stand. *Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews* (2026). https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/
- ACSM. *2026 Resistance Training Guidelines — First Update in 17 Years*. https://acsm.org/resistance-training-guidelines-update-2026/
- Schoenfeld BJ, Ogborn D, Krieger JW. *Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis.* J Sports Sci. 2017. https://pubmed.ncbi.nlm.nih.gov/27433992/
- Arntz F et al. *Optimising the Dose of Static Stretching to Improve Flexibility: A Systematic Review, Meta-analysis and Multivariate Meta-regression.* Sports Med. 2024. https://pubmed.ncbi.nlm.nih.gov/39614059/
- Practical recommendations on stretching exercise: Delphi consensus (2025). https://www.sciencedirect.com/science/article/pii/S2095254625000468
- NASM. *Corrective Exercise Continuum (CEx) Guide*. https://blog.nasm.org/ces/a-guide-to-nasms-corrective-exercise-continuum

---

**最終更新**：2026-05-18
