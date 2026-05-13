// Muscle catalogue for the posture report.
// Each muscle has a stable ID that matches a <path id="m-<id>"> in the anatomy SVG.
// AI is asked to classify each muscle into weak/tight based on the metrics.

export const MUSCLES = [
  {
    id: "deep_neck_flexors",
    label: "深層頸部屈筋群",
    side: "front",
    region: "neck",
    typicalRole: "weak",
    weakNote: "頭部を正しい位置で支える力が低下",
    tightNote: "頸部前面の緊張で頭部前方位が固定化",
  },
  {
    id: "pectorals",
    label: "胸筋群（大胸筋・小胸筋）",
    side: "front",
    region: "chest",
    typicalRole: "tight",
    weakNote: "胸郭の安定性不足",
    tightNote: "巻き肩の原因",
  },
  {
    id: "scapular_stabilizers",
    label: "肩甲骨周囲筋（菱形筋・前鋸筋）",
    side: "back",
    region: "scapula",
    typicalRole: "weak",
    weakNote: "肩甲骨の安定性が不足",
    tightNote: "肩甲骨の動きが制限される",
  },
  {
    id: "abdominals",
    label: "腹筋群（体幹前面）",
    side: "front",
    region: "abdomen",
    typicalRole: "weak",
    weakNote: "体幹の支持力が不足",
    tightNote: "体幹屈曲過剰で骨盤後傾を助長",
  },
  {
    id: "glutes",
    label: "臀筋群（お尻）",
    side: "back",
    region: "hip",
    typicalRole: "weak",
    weakNote: "骨盤の安定性・立位保持力の低下",
    tightNote: "股関節の動きが制限される",
  },
  {
    id: "upper_traps",
    label: "肩甲挙筋・僧帽筋上部",
    side: "back",
    region: "neck",
    typicalRole: "tight",
    weakNote: "肩を引き上げる力の低下",
    tightNote: "首こり・肩こりの原因",
  },
  {
    id: "erector_spinae",
    label: "腰背部筋群（脊柱起立筋）",
    side: "back",
    region: "lowback",
    typicalRole: "tight",
    weakNote: "背中を伸展させる力の低下",
    tightNote: "背中の張りの原因",
  },
  {
    id: "hamstrings",
    label: "ハムストリングス（太もも裏）",
    side: "back",
    region: "thigh",
    typicalRole: "tight",
    weakNote: "膝屈曲・股関節伸展の力が不足",
    tightNote: "骨盤後傾の原因",
  },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

export function muscleIds() {
  return MUSCLES.map((m) => m.id);
}
