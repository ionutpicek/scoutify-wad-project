export function gradeGameGK({ derived }) {
  let score = 0;
  let weightSum = 0;

  // Fallbacks if savePct/xCG not present
  const savePct =
    derived.savePct != null
      ? Number(derived.savePct)
      : derived.saves_p90 != null && (derived.shotsAgainst || (derived.goalsConceded_p90 || derived.saves_p90))
        ? Number(derived.saves_p90) / Number((derived.shotsAgainst || (derived.goalsConceded_p90 + derived.saves_p90)) || 1)
        : null;

  const xCGdiff = derived.xCG_diff_p90 != null ? Number(derived.xCG_diff_p90) : null;
  const goalsConcRaw = derived.goalsConceded_p90 != null ? Number(derived.goalsConceded_p90) : null;
  // Penalize goals conceded, but cap impact to 4 per 90 and use a small negative value
  // so other positives (saves) can offset a bit without swinging too far.
  const goalsConc =
    goalsConcRaw == null ? null : -Math.min(goalsConcRaw, 4) / 4;

  const metrics = [
    { val: savePct, weight: 0.45 },
    { val: xCGdiff, weight: 0.20 },
    { val: goalsConc, weight: 0.35 },
  ];

  for (const { val, weight } of metrics) {
    if (val == null || Number.isNaN(val)) continue;
    score += val * weight;
    weightSum += Math.abs(weight);
  }

  if (weightSum === 0) {
    return {
      overall10: null,
      confidence: 0
    };
  }

  const normalized = score / weightSum;
  const scaled = Math.round((normalized + 1) * 5 * 10) / 10;
  const overall10 = Math.max(1, scaled); // clamp floor to 1.0 so we never show 0

  return {
    overall10,
    confidence: derived.minutes ? Math.min(1, derived.minutes / 90) : 0
  };
}
