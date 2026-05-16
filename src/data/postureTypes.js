// 整骨院でよく見られる姿勢7分類（IMG_0416 / IMG_0417 参照）。
// 各タイプは MediaPipe 計測値から classifyPostureType() で振り分けられ、
// レポート1ページ目のバッジと AI への参考情報に使われる。

export const POSTURE_TYPES = [
  {
    id: "ideal",
    no: 1,
    label: "理想姿勢タイプ",
    short: "理想姿勢",
    landmarks: "外耳孔・肩峰・大転子・膝関節裂隙・外果",
    description: "耳・肩・骨盤・膝・くるぶしが一直線上に整った姿勢",
  },
  {
    id: "kyphosis",
    no: 2,
    label: "猫背・円背タイプ",
    short: "猫背・円背",
    landmarks: "外耳孔・C7・肩峰・胸椎後弯頂点・肩甲骨内側縁",
    description: "頭が前に出て、背中が丸くなりやすい姿勢",
  },
  {
    id: "lordosis",
    no: 3,
    label: "反り腰タイプ",
    short: "反り腰",
    landmarks: "ASIS・PSIS・大転子・剣状突起・恥骨結合・膝関節裂隙",
    description: "骨盤が前傾し、腰の反りが強くなりやすい姿勢",
  },
  {
    id: "swayback",
    no: 4,
    label: "スウェイバックタイプ",
    short: "スウェイバック",
    landmarks: "外耳孔・肩峰・ASIS・PSIS・大転子・膝関節裂隙",
    description: "骨盤が前にずれ、上半身が後ろへ倒れやすい姿勢",
  },
  {
    id: "flatback",
    no: 5,
    label: "フラットバックタイプ",
    short: "フラットバック",
    landmarks: "C7・胸椎/腰椎棘突起ライン・ASIS・PSIS・大転子",
    description: "背骨のS字カーブが少なく、腰の反りが少ない姿勢",
  },
  {
    id: "asymmetry",
    no: 6,
    label: "左右アンバランスタイプ",
    short: "左右アンバランス",
    landmarks: "左右肩峰・左右PSIS・左右大転子・左右膝蓋骨中央",
    description: "肩や骨盤の高さに左右差がある姿勢",
  },
  {
    id: "combined",
    no: 7,
    label: "複合タイプ",
    short: "複合タイプ",
    landmarks: "外耳孔・肩峰・C7・ASIS・PSIS・大転子",
    description: "複数の特徴が重なっている姿勢（例：猫背＋左右差）",
  },
];

export const POSTURE_TYPE_BY_ID = Object.fromEntries(
  POSTURE_TYPES.map((t) => [t.id, t]),
);
