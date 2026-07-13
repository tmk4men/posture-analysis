// 姿勢逸脱の臨床しきい値（単一の真実源）。
// recommend.js（筋肉・種目の自動選定）と diagnosis.js（所見文の自動生成）の
// 両方がこの値を参照することで、「選ばれた筋肉」と「書かれた文章」が
// まったく同じカットオフで反応することを保証する。
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
  knee_hyper: 2,       // 膝過伸展：178°を超えた度数
  knee_flex: 5,        // 膝屈曲位：165°を下回った度数
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
