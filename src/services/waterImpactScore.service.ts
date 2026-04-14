export interface WaterImpactScoreParams {
  baselineWaterIndex: number;
  currentSoilMoisture: number;
  currentDroughtRisk: number;
  snapshotCount: number;
  hasValidatorApproval: boolean;
  validatorTrustScore: number;
}

export interface WaterComponentScores {
  baselineImprovement: number;
  moistureStability: number;
  droughtRiskReduction: number;
  proofCompleteness: number;
  validatorConfidence: number;
}

export interface WaterImpactScoreResult {
  totalScore: number;
  grade: string;
  explanation: string;
  componentScores: WaterComponentScores;
  eligibleForCredits: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * DPAL Water Impact Score formula (0–100):
 *   baselineImprovement  30 pts — soil moisture improvement vs baseline
 *   moistureStability    20 pts — absolute moisture level adequacy
 *   droughtRiskReduction 15 pts — inverse of current drought risk
 *   proofCompleteness    15 pts — snapshot count coverage
 *   validatorConfidence  20 pts — validator trust score (0 if not approved)
 */
export function calculateWaterImpactScore(
  params: WaterImpactScoreParams
): WaterImpactScoreResult {
  const {
    baselineWaterIndex,
    currentSoilMoisture,
    currentDroughtRisk,
    snapshotCount,
    hasValidatorApproval,
    validatorTrustScore,
  } = params;

  // baselineImprovement (30 pts)
  const improvement = currentSoilMoisture - baselineWaterIndex;
  const baselineImprovement = clamp((improvement / 0.3) * 30, 0, 30);

  // moistureStability (20 pts)
  let moistureStability: number;
  if (currentSoilMoisture >= 0.4) {
    moistureStability = 20;
  } else if (currentSoilMoisture >= 0.25) {
    moistureStability = 12;
  } else {
    moistureStability = 6;
  }

  // droughtRiskReduction (15 pts)
  const droughtRiskReduction = clamp((1 - currentDroughtRisk) * 15, 0, 15);

  // proofCompleteness (15 pts)
  const proofCompleteness = clamp((snapshotCount / 3) * 15, 0, 15);

  // validatorConfidence (20 pts)
  const validatorConfidence = hasValidatorApproval
    ? clamp(validatorTrustScore, 0, 1) * 20
    : 0;

  const rawTotal =
    baselineImprovement +
    moistureStability +
    droughtRiskReduction +
    proofCompleteness +
    validatorConfidence;

  const totalScore = Math.round(rawTotal);

  let grade: string;
  if (totalScore >= 90) {
    grade = "A";
  } else if (totalScore >= 70) {
    grade = "B";
  } else if (totalScore >= 50) {
    grade = "C";
  } else if (totalScore >= 40) {
    grade = "D";
  } else {
    grade = "F";
  }

  const eligibleForCredits = totalScore >= 70;

  const improvementPct = Math.round(improvement * 100);
  const droughtPct = Math.round((1 - currentDroughtRisk) * 100);

  const explanation =
    `Water Impact Score ${totalScore}/100 (${grade}). ` +
    `Soil moisture improved by ${improvementPct >= 0 ? "+" : ""}${improvementPct}% vs baseline ` +
    `(contributing ${Math.round(baselineImprovement)}/30 pts). ` +
    `Moisture stability: ${Math.round(moistureStability)}/20 pts at current level ${currentSoilMoisture.toFixed(2)}. ` +
    `Drought risk reduction: ${Math.round(droughtRiskReduction)}/15 pts (${droughtPct}% risk-free index). ` +
    `Proof completeness: ${Math.round(proofCompleteness)}/15 pts from ${snapshotCount} snapshot(s). ` +
    `Validator confidence: ${Math.round(validatorConfidence)}/20 pts${hasValidatorApproval ? ` (trust score ${validatorTrustScore.toFixed(2)})` : " (no validator approval yet)"}. ` +
    (eligibleForCredits
      ? "Project qualifies for DPAL Verified Water Impact credit issuance."
      : "Score below 70 — additional monitoring or validator approval required before credit issuance.");

  const componentScores: WaterComponentScores = {
    baselineImprovement: parseFloat(baselineImprovement.toFixed(2)),
    moistureStability: parseFloat(moistureStability.toFixed(2)),
    droughtRiskReduction: parseFloat(droughtRiskReduction.toFixed(2)),
    proofCompleteness: parseFloat(proofCompleteness.toFixed(2)),
    validatorConfidence: parseFloat(validatorConfidence.toFixed(2)),
  };

  return { totalScore, grade, explanation, componentScores, eligibleForCredits };
}
