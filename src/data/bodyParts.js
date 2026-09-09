// 体の部位カタログ。
//
// 整骨院からの要望（2026-09-09）で、レポートの「鍛えるべき筋肉／ほぐすべき筋肉」は
// 解剖学の筋肉名を出さず、一般の方が読んで分かる部位名だけにする。
// 表記は先方から届いた部位の色分け図（前面 IMG_3130 / 後面 IMG_3131）どおり。
//   plain  … 図で大きく書かれている一般語（首・肩・お腹 …）
//   formal … 図のカッコ内の表記（頚部・肩部・腹部 …）
//
// 部位ごとの色は持たない。図と同じ色をチップに付けていたが、
// 「項目ごとの色分けはなくしてほしい」と先方から指示があり外した（2026-09-09）。
// 色つきの版が要るときは commit 6f2846c 時点の accent / tint を参照。
//
// 図にあって今のところ筋肉が紐づいていない部位（肘部・前腕部・膝部・下腿部前面・足部）も
// 落とさずに残す。先方が挙げた部位の一覧をそのまま持っておくため。

export const BODY_PARTS = {
  neck:        { plain: "首",           formal: "頚部" },
  shoulder:    { plain: "肩",           formal: "肩部" },
  upperarm:    { plain: "二の腕",       formal: "上腕部" },
  elbow:       { plain: "ひじ",         formal: "肘部" },
  forearm:     { plain: "ひじ下",       formal: "前腕部" },
  chest:       { plain: "胸",           formal: "胸部" },
  abdomen:     { plain: "お腹",         formal: "腹部" },
  back:        { plain: "背中",         formal: "背部" },
  lowback:     { plain: "腰",           formal: "腰部" },
  hip:         { plain: "おしり",       formal: "臀部" },
  hipjoint:    { plain: "股関節",       formal: "股関節部" },
  thigh_front: { plain: "太ももの前",   formal: "大腿部・前面" },
  thigh_inner: { plain: "太ももの内側", formal: "大腿部・内側" },
  thigh_back:  { plain: "太ももの後ろ", formal: "大腿部・後面" },
  knee:        { plain: "ひざ",         formal: "膝部" },
  shin:        { plain: "すね",         formal: "下腿部・前面" },
  calf:        { plain: "ふくらはぎ",   formal: "下腿部・後面" },
  foot:        { plain: "足",           formal: "足部" },
};

// 未知のIDが来ても表が崩れないようにする（筋肉を足して bodyPart を書き忘れたとき用）。
const FALLBACK = { plain: "—", formal: "部位未設定" };

export function bodyPart(id) {
  return BODY_PARTS[id] || FALLBACK;
}

// 「首（頚部）」の形。表・図の両方でこの並びに揃える。
export function bodyPartLabel(id) {
  const p = bodyPart(id);
  return `${p.plain}（${p.formal}）`;
}
