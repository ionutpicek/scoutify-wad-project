// src/services/stats/derivedMetrics.js

const per90 = (v, min) => (min > 0 ? (v * 90) / min : 0);
const safeDiv = (a, b) => (b > 0 ? a / b : 0);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export function computeDerivedMetrics(t) {
  const m = Number(t.minutes) || 0;
  const has = key => hasOwn(t, key);
  const hasAny = keys => keys.some(key => has(key));

  // ----------------------------
  // COMMON (ALL PLAYERS)
  // ----------------------------
  const base = {
    minutes: m,

    // Passing (general)
    passes_p90: has("passes") ? per90(t.passes || 0, m) : null,
    passAccuracy: has("passes")
      ? safeDiv(t.accuratePasses || 0, t.passes || 0)
      : null,

    forwardPasses_p90: has("forwardPasses") ? per90(t.forwardPasses || 0, m) : null,
    forwardPassAccuracy: has("forwardPasses")
      ? safeDiv(t.forwardPassesAccurate || 0, t.forwardPasses || 0)
      : null,

    progressivePasses_p90: has("progressivePasses")
      ? per90(t.progressivePasses || 0, m)
      : null,
    progressivePassAccuracy: has("progressivePasses")
      ? safeDiv(t.progressivePassesAccurate || 0, t.progressivePasses || 0)
      : null,

    longPasses_p90: has("longPasses") ? per90(t.longPasses || 0, m) : null,
    longPassAccuracy: has("longPasses")
      ? safeDiv(t.longPassesAccurate || 0, t.longPasses || 0)
      : null,
  };

  // ----------------------------
  // GOALKEEPER METRICS
  // ----------------------------
  const isGK =
      t.primaryRole === "GK" ||
      t.position === "GK" ||
      (Array.isArray(t.positions) && t.positions.includes("GK"));

    if (isGK) {
      
    return {
      ...base,

      // Shot stopping
      saves_p90: has("saves") ? per90(t.saves || 0, m) : null,
      goalsConceded_p90: has("concededGoals")
        ? per90(t.concededGoals || 0, m)
        : null,
      savePct: hasAny(["saves", "shotsAgainst"])
        ? safeDiv(t.saves || 0, t.shotsAgainst || 0)
        : null,

      // Expected goals prevented
      xCG_p90: has("xCG") ? per90(t.xCG || 0, m) : null,
      // Only compute diff when xCG is provided; avoid penalizing missing xCG
      xCG_diff_p90: has("xCG") && has("concededGoals")
        ? per90((t.xCG || 0) - (t.concededGoals || 0), m)
        : null,

      longGKAccuracy: has("longGoalKicks")
        ? safeDiv(t.longGoalKicksAccurate || 0, t.longGoalKicks || 0)
        : null,


      // Area control
      exits_p90: has("exits") ? per90(t.exits || 0, m) : null,

      // Distribution (GK-specific)
      goalKicks_p90: has("goalKicks") ? per90(t.goalKicks || 0, m) : null,
      longGoalKicks_p90: has("longGoalKicks")
        ? per90(t.longGoalKicks || 0, m)
        : null,
    };
  }

  // ----------------------------
  // OUTFIELD PLAYER METRICS
  // ----------------------------
  return {
    ...base,

    // ----------------------------
    // ATTACKING
    // ----------------------------
    goals_p90: has("goals") ? per90(t.goals || 0, m) : null,
    xG_p90: has("xG") ? per90(t.xG || 0, m) : null,
    assists_p90: has("assists") ? per90(t.assists || 0, m) : null,
    secondAssists_p90: has("secondAssists")
      ? per90(t.secondAssists || 0, m)
      : null,

    shots_p90: has("shots") ? per90(t.shots || 0, m) : null,
    shotsOnTarget_p90: has("shotsOnTarget")
      ? per90(t.shotsOnTarget || 0, m)
      : null,
    shotAccuracy: has("shots")
      ? safeDiv(t.shotsOnTarget || 0, t.shots || 0)
      : null,

    touchesBox_p90: has("touchesInPenaltyArea")
      ? per90(t.touchesInPenaltyArea || 0, m)
      : null,
    progressiveRuns_p90: has("progressiveRuns")
      ? per90(t.progressiveRuns || 0, m)
      : null,

    // Creativity
    shotAssists_p90: has("shotAssists")
      ? per90(t.shotAssists || 0, m)
      : null,
    xA_p90: has("xA") ? per90(t.xA || 0, m) : null,
    throughPasses_p90: has("throughPasses")
      ? per90(t.throughPasses || 0, m)
      : null,
    throughPassAccuracy: has("throughPasses")
      ? safeDiv(t.throughPassesAccurate || 0, t.throughPasses || 0)
      : null,

    // ----------------------------
    // PASSING (ADVANCED)
    // ----------------------------
    finalThirdPasses_p90: has("passesFinalThird")
      ? per90(t.passesFinalThird || 0, m)
      : null,
    finalThirdPassAccuracy: has("passesFinalThird")
      ? safeDiv(t.passesFinalThirdAccurate || 0, t.passesFinalThird || 0)
      : null,

    penaltyAreaPasses_p90: has("passesPenaltyArea")
      ? per90(t.passesPenaltyArea || 0, m)
      : null,
    penaltyAreaPassAccuracy: has("passesPenaltyArea")
      ? safeDiv(t.passesPenaltyAreaAccurate || 0, t.passesPenaltyArea || 0)
      : null,

    crosses_p90: has("crosses") ? per90(t.crosses || 0, m) : null,
    crossesAccurate_p90: has("crossesAccurate")
      ? per90(t.crossesAccurate || 0, m)
      : null,
    crossAccuracy: has("crosses")
      ? safeDiv(t.crossesAccurate || 0, t.crosses || 0)
      : null,

    // ----------------------------
    // DUELS & DEFENDING
    // ----------------------------
    duels_p90: has("duels") ? per90(t.duels || 0, m) : null,
    duelWinPct: has("duels")
      ? safeDiv(t.duelsWon || 0, t.duels || 0)
      : null,

    defensiveDuels_p90: has("defensiveDuels")
      ? per90(t.defensiveDuels || 0, m)
      : null,
    defensiveDuelWinPct: has("defensiveDuels")
      ? safeDiv(t.defensiveDuelsWon || 0, t.defensiveDuels || 0)
      : null,

    offensiveDuels_p90: has("offensiveDuels")
      ? per90(t.offensiveDuels || 0, m)
      : null,
    offensiveDuelWinPct: has("offensiveDuels")
      ? safeDiv(t.offensiveDuelsWon || 0, t.offensiveDuels || 0)
      : null,

    aerialDuels_p90: has("aerialDuels")
      ? per90(t.aerialDuels || 0, m)
      : null,
    aerialDuelWinPct: has("aerialDuels")
      ? safeDiv(t.aerialDuelsWon || 0, t.aerialDuels || 0)
      : null,

    interceptions_p90: has("interceptions")
      ? per90(t.interceptions || 0, m)
      : null,
    recoveriesOppHalf_p90: has("recoveriesOppHalf")
      ? per90(t.recoveriesOppHalf || 0, m)
      : null,
    recoveries_p90: has("recoveries")
      ? per90(t.recoveries || 0, m)
      : null,
    lossesOwnHalf_p90: has("lossesOwnHalf")
      ? per90(t.lossesOwnHalf || 0, m)
      : null,
    losses_p90: has("losses")
      ? per90(t.losses || 0, m)
      : null,

    clearances_p90: has("clearances") ? per90(t.clearances || 0, m) : null,

    // ----------------------------
    // DISCIPLINE & ERRORS
    // ----------------------------
    fouls_p90: has("fouls") ? per90(t.fouls || 0, m) : null,
    foulsSuffered_p90: has("foulsSuffered")
      ? per90(t.foulsSuffered || 0, m)
      : null,

    yellowCards_p90: has("yellowCards")
      ? per90(t.yellowCards || 0, m)
      : null,
    redCards_p90: has("redCards") ? per90(t.redCards || 0, m) : null,

    offsides_p90: has("offsides") ? per90(t.offsides || 0, m) : null,
  };
}
