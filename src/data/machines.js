// Machine catalogue available at the client's gym (from reference images 3 & 4).
// AI must pick exactly 4 machines from this list when generating the training plan.

export const MACHINES = [
  // From image 3 (page 1 of catalogue)
  { id: "assisted_chin_dip", label: "アシステッドチン、ディップ", targets: ["背中", "胸"] },
  { id: "adjustable_situp_bench", label: "アジャスタブルシットアップベンチ", targets: ["腹筋"] },
  { id: "adjustable_flat_incline_bench", label: "アジャスタブルフラット、インクラインベンチ", targets: ["胸", "肩"] },
  { id: "upright_bike", label: "アップライトバイク", targets: ["有酸素", "下肢"] },
  { id: "shoulder_press", label: "ショルダープレス", targets: ["肩"] },
  { id: "step_mill", label: "ステップミル", targets: ["有酸素", "下肢"] },
  { id: "dual_pulley", label: "デュアルプーリー", targets: ["全身"] },
  { id: "treadmill", label: "トレッドミル", targets: ["有酸素"] },
  { id: "plate_pulldown", label: "プレートロードプルダウン", targets: ["背中", "肩甲骨"] },
  { id: "pec_fly_rear_delt", label: "ペックフライ、リアデルト", targets: ["胸", "肩甲骨周囲"] },
  { id: "lying_leg_curl", label: "ライイングレッグカール", targets: ["ハムストリングス"] },
  { id: "stretch_adductor", label: "ラクレッチ、アダクター", targets: ["内転筋ストレッチ"] },
  { id: "leg_extension", label: "レッグエクステンション", targets: ["大腿四頭筋"] },
  { id: "leg_extension_2", label: "レッグエクステンション2", targets: ["大腿四頭筋"] },
  { id: "rotary_torso", label: "ロータリートルソー", targets: ["体幹回旋"] },
  { id: "rotary_torso_2", label: "ロータリートルソー2", targets: ["体幹回旋"] },

  // From image 4 (page 2 of catalogue)
  { id: "abdominal", label: "アブドミナル", targets: ["腹筋"] },
  { id: "inner_outer_thigh", label: "インナー、アウターサイ", targets: ["内転筋", "外転筋"] },
  { id: "elliptical", label: "エリプティカル", targets: ["有酸素"] },
  { id: "seated_chest_press", label: "シーテッドチェストプレス", targets: ["胸"] },
  { id: "seated_leg_curl", label: "シーテッドレッグカール", targets: ["ハムストリングス"] },
  { id: "seated_leg_press", label: "シーテッドレッグプレス", targets: ["下肢"] },
  { id: "seated_row", label: "シーテッドロウ", targets: ["背中", "肩甲骨"] },
  { id: "back_extension_bench", label: "バックエクステンションベンチ", targets: ["脊柱起立筋"] },
  { id: "hack_squat", label: "ハックスクワット", targets: ["下肢"] },
  { id: "power_leg_press", label: "パワーレッグプレス", targets: ["下肢"] },
  { id: "hip_thrust", label: "ヒップスラスト", targets: ["臀筋"] },
  { id: "plate_incline_press", label: "プレートロードインクラインプレス", targets: ["胸上部"] },
  { id: "plate_seated_chest", label: "プレートロードシーテッドチェストプレス", targets: ["胸"] },
  { id: "plate_seated_row", label: "プレートロードシーテッドロウ", targets: ["背中"] },
  { id: "stretch_shoulder", label: "ラクレッチ、ショルダー", targets: ["肩ストレッチ"] },
  { id: "stretch_chest", label: "ラクレッチ、チェスト", targets: ["胸ストレッチ"] },
  { id: "stretch_twister", label: "ラクレッチ、ツイスター", targets: ["体幹ストレッチ"] },
  { id: "stretch_hip", label: "ラクレッチ、ヒップ", targets: ["股関節ストレッチ"] },
  { id: "lat_pulldown_seated_row", label: "ラットプルダウン、シーテッドロウ", targets: ["背中"] },
  { id: "lat_pulldown", label: "ラットプルダウン", targets: ["背中"] },
  { id: "recumbent_bike", label: "リカンベントバイク", targets: ["有酸素"] },
];

export const MACHINE_BY_ID = Object.fromEntries(MACHINES.map((m) => [m.id, m]));

export function machineIds() {
  return MACHINES.map((m) => m.id);
}
