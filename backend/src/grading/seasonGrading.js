import { ROLE_WEIGHTS } from "./roleWeights.js";
import { percentileRank } from "./percentiles.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function scoreMetric({ metric, weight, playerDerived, peerDerivedList }) {
  if (!hasOwn(playerDerived || {}, metric)) return null;
  const v = Number(playerDerived?.[metric]);
  if (Number.isNaN(v)) return null;

  const peerValues = peerDerivedList
    .filter(p => hasOwn(p || {}, metric))
    .map(p => Number(p?.[metric]))
    .filter(val => Number.isFinite(val))
    .sort((a, b) => a - b);

  if (!peerValues.length) return null;

  const pct = percentileRank(v, peerValues);

  let adjPct = weight < 0 ? (1 - pct) : pct;

  const disciplineZeroIsGood = [
    "yellowCards_p90",
    "redCards_p90",
    "fouls_p90"
  ];

  if (disciplineZeroIsGood.includes(metric) && v === 0) {
    adjPct = 0.75;
  }

  adjPct = clamp01(Math.max(0.15, Math.min(0.95, adjPct)));

  return adjPct * 100;
}

export function gradeSeason({ role, totals, peerDerivedList }) {
  const roleDef = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.GENERIC;
  const derived = totals.derived || {};

  const categoryWeights = roleDef.__categoryWeights || {};
  const subGrades = {};

  let overallWeighted = 0;
  let overallWeightSum = 0;

  for (const [category, metrics] of Object.entries(roleDef)) {
    if (category === "__categoryWeights") continue;

    let catScore = 0;
    let catMetricWeightSum = 0;

    for (const [metric, weight] of Object.entries(metrics)) {
      const score = scoreMetric({
        metric,
        weight,
        playerDerived: derived,
        peerDerivedList
      });

      if (score == null) continue;

      const absW = Math.abs(weight);
      catScore += score * absW;
      catMetricWeightSum += absW;
    }

    if (catMetricWeightSum === 0) continue;

    const cat_100 = catScore / catMetricWeightSum;
    subGrades[category] = Math.round(cat_100);

    const catWeight = categoryWeights[category] ?? 1;
    overallWeighted += cat_100 * catWeight;
    overallWeightSum += catWeight;
  }

  const overall100 =
    overallWeightSum > 0 ? overallWeighted / overallWeightSum : 0;

  const minutes = Number(totals.minutes) || 0;
  const confidence = clamp01(minutes / 900);

  return {
    version: 1,
    role,
    overall10: Math.round(overall100) / 10,
    overall100: Math.round(overall100),
    subGrades,
    confidence
  };
}