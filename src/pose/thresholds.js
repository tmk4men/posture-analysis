// 姿勢逸脱の臨床しきい値（単一の真実源）。
// angles.js（レポートの warn/ok バッジ）・recommend.js（筋肉・種目の自動選定）・
// diagnosis.js（所見文の自動生成）がすべてこの値を参照することで、
// 「バッジの色」「選ばれた筋肉」「書かれた文章」が
// まったく同じカットオフで反応することを保証する。
// ここを書き換えれば3箇所すべてが追随する。ベタ書きを増やさないこと。
//
// 値の意味・根拠は DIAGNOSIS_RULEBOOK.md の「しきい値定義」を参照。

export const WARN = {
  forward_head: 10,    // 頭部前方位：体幹高に対する％
  shoulder_forward: 8, // 肩の前方変位：体幹高に対する％
  trunk_lean: 5,       // 体幹の前後傾：度
  shoulder_tilt: 2,    // 肩の傾き：度
  pelvic_tilt: 2,      // 骨盤の傾き：度
  head_tilt: 3,        // 頭部の傾き：度
  lateral_shift: 5,    // 上半身の左右シフト：肩幅に対する％
  knee_hyper: 2,       // 膝過伸展：KNEE.hyper を超えた度数
  knee_flex: 5,        // 膝屈曲位：KNEE.flex を下回った度数
  // 骨盤の前方変位：体幹高に対する％。理想姿勢では大転子は外果のほぼ真上で、
  // ここが 8%（体幹高60cmなら約5cm）前に出るとスウェイバックの形が見えてくる。
  pelvis_shift: 8,
  // 膝の内外反：下肢長に対する％（＋＝O脚 / −＝X脚）。
  // 下肢長80cmなら 4% ≒ 膝が片側3cm外へ張り出す量。
  // 実写例は 2.7%（軽度）で、この値では L4 と判定されない。
  knee_alignment: 4,
};

// 膝角度（hip–knee–ankle の内角）の中立ゾーン境界：度。
// KNEE.hyper 以上＝過伸展、KNEE.flex 未満＝屈曲位、その間＝中立。
// 他の指標と違い「0からの逸脱」ではないので、この境界からの差を
// WARN.knee_hyper / WARN.knee_flex で正規化して ratio を作る。
//
// angles.js の signedKneeAngle は「膝が股関節→足首の線より後ろにある」ときだけ
// 180 を超える値を返す。旧実装は符号なしの内角（0〜180）を使っていたため、
// hyper=178 は〈わずかに曲がった膝〉を過伸展と呼び、本物の反張膝は
// 180 を超えられず一度も検出できなかった。
// hyper は臨床で反張膝とされる 5°（＝185°）に置く。MediaPipe の関節推定誤差でも
// これだけの後方偏位は出にくく、まっすぐ立った脚を拾わない。
export const KNEE = {
  hyper: 185,
  flex: 165,
};

// 所見は臨床しきい値の半分（0.5倍）から拾い上げる。
// 軽微な逸脱でも「傾向」として文章化し、重い所見の下位にソートする。
export const ENTRY_RATIO = 0.5;

// MediaPipe の visibility 下限。側面写真では遠い側の脚がほぼ隠れて
// visibility が 0.0x まで落ちる。この値未満の点は計測に使わない
// （使うと存在しない位置を推定した座標で膝角度を出してしまう）。
export const VISIBILITY_FLOOR = 0.25;

// 撮影のチェック（計測を止めるものではなく、精度を落とす条件の検出）。
export const CAPTURE = {
  // 肩幅 ÷ 体幹高。正面/背面ならこの値以上、側面ならこの値以下が正常。
  // 実測：正面 0.61 / 側面 0.12。間を大きく空けて誤警告を防ぐ。
  frontal_ratio_min: 0.35,
  sagittal_ratio_max: 0.28,
  // 正面で耳幅 ÷ 肩幅がこれ未満なら顔が横を向いている（頭部の傾きが測れない）。
  ear_span_min: 0.20,
  // 側面で 耳→鼻 の線が水平から何度下がっているか。うつむくと頭部前方位が過大に出る。
  head_pitch_down_max: 35,
  // 同・上を向きすぎ（鼻が耳より上）。
  head_pitch_up_min: 0,
};

// 指定ビュー・キーの計測値オブジェクトを取り出す小ヘルパー。
export function getMetric(byView, view, key) {
  const arr = byView?.[view];
  if (!arr) return null;
  return arr.find((m) => m.key === key) ?? null;
}
