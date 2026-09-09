// 体の部位カタログ。
//
// 整骨院からの要望（2026-09-09）で、レポートの「鍛えるべき筋肉／ほぐすべき筋肉」は
// 解剖学の筋肉名だけでなく、一般の方が読んで分かる部位名を先に出す。
// 表記と色は先方から届いた部位の色分け図（前面 IMG_3130 / 後面 IMG_3131）に合わせてある。
//   plain  … 図で大きく書かれている一般語（首・肩・お腹 …）
//   formal … 図のカッコ内の表記（頚部・肩部・腹部 …）
//   accent … 図の引き出し線・枠の色（実画像から抽出）
//   tint   … 図のラベル枠の淡い塗り（同上）
//
// 図にあって今のところ筋肉が紐づいていない部位（肘部・前腕部・膝部・下腿部前面・足部）も
// 落とさずに残す。先方が挙げた部位の一覧をそのまま持っておくため。

export const BODY_PARTS = {
  neck:        { plain: "首",           formal: "頚部",         accent: "#7B4FBF", tint: "#E4D7F5" },
  shoulder:    { plain: "肩",           formal: "肩部",         accent: "#D86820", tint: "#F9DCC6" },
  upperarm:    { plain: "二の腕",       formal: "上腕部",       accent: "#C84068", tint: "#F9D3E0" },
  elbow:       { plain: "ひじ",         formal: "肘部",         accent: "#389018", tint: "#D8F2CC" },
  forearm:     { plain: "ひじ下",       formal: "前腕部",       accent: "#20A098", tint: "#C8F2F2" },
  chest:       { plain: "胸",           formal: "胸部",         accent: "#3080D0", tint: "#CBDEF9" },
  abdomen:     { plain: "お腹",         formal: "腹部",         accent: "#208038", tint: "#D0F0CC" },
  back:        { plain: "背中",         formal: "背部",         accent: "#3080D0", tint: "#CBDEF9" },
  lowback:     { plain: "腰",           formal: "腰部",         accent: "#189030", tint: "#D0F0CC" },
  hip:         { plain: "おしり",       formal: "臀部",         accent: "#C02060", tint: "#F9D0DE" },
  hipjoint:    { plain: "股関節",       formal: "股関節部",     accent: "#D84870", tint: "#F9D0DE" },
  thigh_front: { plain: "太ももの前",   formal: "大腿部・前面", accent: "#C9A81F", tint: "#F9F2C4" },
  thigh_inner: { plain: "太ももの内側", formal: "大腿部・内側", accent: "#C9A81F", tint: "#F9F2C4" },
  thigh_back:  { plain: "太ももの後ろ", formal: "大腿部・後面", accent: "#C9A81F", tint: "#F9F2C4" },
  knee:        { plain: "ひざ",         formal: "膝部",         accent: "#8050C0", tint: "#E4D7F5" },
  shin:        { plain: "すね",         formal: "下腿部・前面", accent: "#189870", tint: "#C8F2E2" },
  calf:        { plain: "ふくらはぎ",   formal: "下腿部・後面", accent: "#20A888", tint: "#C8F2E8" },
  foot:        { plain: "足",           formal: "足部",         accent: "#1880D8", tint: "#C2DEF9" },
};

// 未知のIDが来ても表が崩れないようにする（筋肉を足して bodyPart を書き忘れたとき用）。
const FALLBACK = { plain: "—", formal: "部位未設定", accent: "#8a8a8a", tint: "#eeeeee" };

export function bodyPart(id) {
  return BODY_PARTS[id] || FALLBACK;
}

// 「首（頚部）」の形。表・図の両方でこの並びに揃える。
export function bodyPartLabel(id) {
  const p = bodyPart(id);
  return `${p.plain}（${p.formal}）`;
}
