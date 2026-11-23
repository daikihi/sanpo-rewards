import { EvaluatedRule, RewardRule, WalkInput, WalkSummary } from "./types";

export const STEPS_PER_KM = 1400;

function nonNeg(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function estimateStepsFromKm(distanceKm: number): number {
  return Math.round(nonNeg(distanceKm) * STEPS_PER_KM);
}

function roundToDecimals(value: number, decimals: number): number {
  const clamped = Math.max(0, Math.min(4, Math.floor(decimals)));
  const factor = Math.pow(10, clamped);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function summarizeWalks(records: WalkInput[]): WalkSummary {
  let grossSavedFareYen = 0;
  let sustenanceCostYen = 0;
  let rewardSpentYen = 0;
  let distanceKm = 0;
  let totalSteps = 0;
  let durationMinutes = 0;
  let detourCount = 0;

  for (const r of records) {
    const planned = nonNeg(r.plannedFareYen);
    const actual = nonNeg(r.actualFareYen);
    const saved = Math.max(0, planned - actual);
    const dist = nonNeg(r.distanceKm);
    const steps =
      typeof r.steps === "number" && Number.isFinite(r.steps) && r.steps >= 0
        ? Math.round(r.steps)
        : estimateStepsFromKm(dist);

    grossSavedFareYen += saved;
    sustenanceCostYen += nonNeg(r.sustenanceCostYen);
    rewardSpentYen += nonNeg(r.rewardSpentYen);
    distanceKm += dist;
    totalSteps += steps;
    durationMinutes += nonNeg(r.durationMinutes);
    detourCount += Math.max(0, Math.floor(nonNeg(r.detourCount)));
  }

  const rewardRemainingYen = grossSavedFareYen - rewardSpentYen;

  return {
    grossSavedFareYen,
    sustenanceCostYen,
    rewardSpentYen,
    rewardRemainingYen,
    distanceKm: roundToDecimals(distanceKm, 2),
    totalSteps,
    durationMinutes: Math.round(durationMinutes),
    detourCount,
  };
}

export function evaluateRule(rule: RewardRule, summary: WalkSummary): EvaluatedRule {
  const rawSource =
    rule.basis === "fare"
      ? Math.max(0, summary.rewardRemainingYen)
      : summary.distanceKm;
  const sourceValue = nonNeg(rawSource);

  if (!Number.isFinite(rule.unitAmount) || rule.unitAmount <= 0) {
    return {
      rule,
      sourceValue,
      rawUnits: 0,
      displayValue: "0",
      integerUnits: 0,
      remainderToNext: 0,
    };
  }

  const rawUnits = sourceValue / rule.unitAmount;
  const integerUnits = Math.floor(rawUnits + 1e-9);
  const nextTarget = (integerUnits + 1) * rule.unitAmount;
  const remainderToNext =
    rule.basis === "fare"
      ? Math.max(0, Math.ceil(nextTarget - sourceValue))
      : Math.max(0, roundToDecimals(nextTarget - sourceValue, 2));

  let displayValue: string;
  if (rule.rounding === "decimal") {
    const d = Math.max(0, Math.min(3, rule.decimals));
    displayValue = roundToDecimals(rawUnits, d).toFixed(d);
  } else if (rule.rounding === "round") {
    displayValue = String(Math.round(rawUnits));
  } else if (rule.rounding === "ceil") {
    displayValue = String(Math.ceil(rawUnits - 1e-9));
  } else {
    displayValue = String(integerUnits);
  }

  return {
    rule,
    sourceValue,
    rawUnits,
    displayValue,
    integerUnits,
    remainderToNext,
  };
}
