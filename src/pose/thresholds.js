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
};

// 膝角度（hip–knee–ankle の内角）の中立ゾーン境界：度。
// KNEE.hyper 以上＝過伸展、KNEE.flex 未満＝屈曲位、その間＝中立。
// 他の指標と違い「0からの逸脱」ではないので、この境界からの差を
// WARN.knee_hyper / WARN.knee_flex で正規化して ratio を作る。
export const KNEE = {
  hyper: 178,
  flex: 165,
};

// 所見は臨床しきい値の半分（0.5倍）から拾い上げる。
// 軽微な逸脱でも「傾向」として文章化し、重い所見の下位にソートする。
export const ENTRY_RATIO = 0.5;

// 指定ビュー・キーの計測値オブジェクトを取り出す小ヘルパー。
export function getMetric(byView, view, key) {
  const arr = byView?.[view];
  if (!arr) return null;
  return arr.find((m) => m.key === key) ?? null;
}
