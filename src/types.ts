export type BasisType = "fare" | "distance";
export type RoundingMode = "floor" | "round" | "ceil" | "decimal";
export type PresetPatternId = "instant" | "accumulate" | "distance_linked";

export interface WalkInput {
  id: string;
  date: string;
  title: string;
  plannedFareYen: number;    // 想定運賃（円）
  actualFareYen: number;     // 実際の運賃（円）
  sustenanceCostYen: number; // 水分・飴・グミ等の補給コスト（ご褒美枠と分離）
  rewardSpentYen: number;    // すでに使ったご褒美支出（円）
  distanceKm: number;        // 歩行距離（km）
  durationMinutes: number;   // 歩行時間（分）
  detourCount: number;       // 寄り道・発見数（軽量カウント）
}

export interface RewardRule {
  id: string;
  pattern: PresetPatternId;
  name: string;
  unitLabel: string; // 例: "円分", "口", "回分"
  basis: BasisType;
  unitAmount: number; // 円 または km（> 0）
  rounding: RoundingMode;
  decimals: number;
  description: string;
}

export interface EvaluatedRule {
  rule: RewardRule;
  sourceValue: number;
  rawUnits: number;
  displayValue: string;
  integerUnits: number;
  remainderToNext: number;
}

export interface WalkSummary {
  grossSavedFareYen: number;  // 浮いた交通費（グロス）
  sustenanceCostYen: number;  // 補給コスト（別枠・ご褒美枠を削らない）
  rewardSpentYen: number;     // ご褒美支出
  rewardRemainingYen: number; // ご褒美に回せる残余額
  distanceKm: number;
  durationMinutes: number;
  detourCount: number;
}
