// src/services/grading/gradeGame.js

const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));

// Unified goal bonus for all roles so scoring is rewarded consistently.
// Attackers still evaluate the metric even at 0 goals (so it's visible); other
// roles only score when they actually net a goal.
const GOAL_BONUS_RULE = { key: "goalBonus_p90", weight: 2, target: [0, 0.2, 0.7, 1.2] };
const ACTION_RULES = {
  CB: [
    { key: "defensiveDuelWinPct", weight: 1.6, target: [0.38, 0.5, 0.62, 0.75] },
    { key: "defensiveDuels_p90", weight: 1.2, target: [3, 6, 9, 13] }
  ],
  FULLBACK: [
    { key: "defensiveDuelWinPct", weight: 1.2, target: [0.34, 0.48, 0.6, 0.72] },
    { key: "defensiveDuels_p90", weight: 1.0, target: [2.5, 5, 8, 12] },
    { key: "offensiveDuelWinPct", weight: 0.8, target: [0.28, 0.42, 0.56, 0.7] },
    { key: "offensiveDuels_p90", weight: 0.7, target: [1.5, 3, 5, 8] }
  ],
  WINGBACK: [
    { key: "defensiveDuelWinPct", weight: 1.1, target: [0.33, 0.47, 0.6, 0.72] },
    { key: "defensiveDuels_p90", weight: 0.9, target: [2.5, 5, 8, 12] },
    { key: "offensiveDuelWinPct", weight: 0.9, target: [0.28, 0.42, 0.56, 0.7] },
    { key: "offensiveDuels_p90", weight: 0.8, target: [1.5, 3, 5, 8] }
  ],
  MIDFIELDER: [
    { key: "defensiveDuelWinPct", weight: 1.0, target: [0.32, 0.45, 0.58, 0.7] },
    { key: "defensiveDuels_p90", weight: 0.9, target: [2, 4, 7, 10] },
    { key: "offensiveDuelWinPct", weight: 0.9, target: [0.28, 0.42, 0.56, 0.7] },
    { key: "offensiveDuels_p90", weight: 0.8, target: [1.5, 3, 5, 8] }
  ],
  WINGER: [
    { key: "offensiveDuelWinPct", weight: 1.1, target: [0.25, 0.4, 0.55, 0.68] },
    { key: "offensiveDuels_p90", weight: 0.9, target: [2, 4, 6.5, 10] }
  ],
  ATTACKER: [
    { key: "offensiveDuelWinPct", weight: 1.0, target: [0.24, 0.38, 0.52, 0.65] },
    { key: "offensiveDuels_p90", weight: 0.7, target: [2, 4, 7, 11] }
  ],
  DEFAULT: [
    { key: "defensiveDuelWinPct", weight: 1.0, target: [0.32, 0.45, 0.58, 0.7] },
    { key: "defensiveDuels_p90", weight: 0.8, target: [2, 4, 7, 10] },
    { key: "offensiveDuelWinPct", weight: 0.8, target: [0.26, 0.4, 0.54, 0.68] },
    { key: "offensiveDuels_p90", weight: 0.6, target: [1.5, 3, 5, 8] }
  ]
};

function getActionRules(role) {
  return ACTION_RULES[role] || ACTION_RULES.DEFAULT;
}
const CARD_PENALTIES = { yellow: 5, red: 25 }; // points on 0-100 scale

const ROLE_RULES = {
  CB: [
    GOAL_BONUS_RULE,
    { key: "duelWinPct", weight: 3, target: [0.3, 0.45, 0.6, 0.8] },
    { key: "passAccuracy", weight: 2, target: [0.55, 0.7, 0.82, 0.9] },
    { key: "forwardPasses_p90", weight: 1.2, target: [8, 14, 22, 32] },
    { key: "forwardPassAccuracy", weight: 1.0, target: [0.45, 0.6, 0.72, 0.82] },
    ...getActionRules("CB"),
    { key: "lossesOwnHalf_p90", weight: 2, target: [12, 8, 5, 2], inverted: true },
    { key: "fouls_p90", weight: 1.5, target: [7, 5, 3, 1.5], inverted: true },
    { key: "shots_p90", weight: 1, target: [0, 0.5, 1, 2] },
    { key: "interceptions_p90", weight: 2, target: [0.3, 1, 2.5, 4] },
    { key: "clearances_p90", weight: 1, target: [1, 2.5, 5, 8] },
    // Optional bonuses: ignored when zero
    { key: "cbAssistBonus_p90", weight: 2, target: [0, 0.04, 0.12, 0.3] }
  ],
  FULLBACK: [
    GOAL_BONUS_RULE,
    { key: "duelWinPct", weight: 2.5, target: [0.3, 0.45, 0.65, 0.82] },
    { key: "passAccuracy", weight: 1.5, target: [0.58, 0.72, 0.84, 0.9] },
    { key: "progressivePasses_p90", weight: 1.0, target: [3, 6, 10, 16] },
    { key: "finalThirdPasses_p90", weight: 1.0, target: [2, 4, 7, 11] },
    { key: "throughPasses_p90", weight: 0.7, target: [0, 0.3, 0.8, 1.6] },
    { key: "keyPasses_p90", weight: 0.8, target: [0, 0.3, 0.8, 1.4] },
    ...getActionRules("FULLBACK"),
    { key: "crossesAccurate_p90", weight: 2, target: [0, 0.4, 1.2, 2.5] },
    { key: "lossesOwnHalf_p90", weight: 2, target: [12, 8, 5, 2], inverted: true },
    { key: "fouls_p90", weight: 0.8, target: [7, 5, 3, 1.5], inverted: true },
    { key: "interceptions_p90", weight: 1, target: [0.3, 1, 2, 3.5] },
    { key: "fbAssistBonus_p90", weight: 1.5, target: [0, 0.04, 0.15, 0.4] },
    { key: "fbCreation_p90", weight: 1.2, target: [0, 0.25, 0.7, 1.2] },
    { key: "fbPassVolume_p90", weight: 1.2, target: [16, 26, 38, 52] }
  ],
  WINGBACK: [
    GOAL_BONUS_RULE,
    { key: "duelWinPct", weight: 2.2, target: [0.3, 0.45, 0.65, 0.8] },
    { key: "passAccuracy", weight: 1.5, target: [0.58, 0.72, 0.84, 0.9] },
    { key: "progressivePasses_p90", weight: 1.1, target: [3, 6, 10, 16] },
    { key: "finalThirdPasses_p90", weight: 1.1, target: [2, 4, 7, 11] },
    { key: "throughPasses_p90", weight: 0.8, target: [0, 0.4, 1.0, 1.8] },
    { key: "keyPasses_p90", weight: 0.9, target: [0, 0.4, 1.0, 1.6] },
    ...getActionRules("WINGBACK"),
    { key: "crossesAccurate_p90", weight: 1.6, target: [0, 0.35, 1.1, 2.2] },
    { key: "lossesOwnHalf_p90", weight: 1.8, target: [12, 8, 5, 2], inverted: true },
    { key: "fouls_p90", weight: 0.8, target: [7, 5, 3, 1.5], inverted: true },
    { key: "interceptions_p90", weight: 1.1, target: [0.3, 1, 2.2, 3.8] }
  ],
  MIDFIELDER: [
    GOAL_BONUS_RULE,
    // Bonuses; skipped when zero
    { key: "midAssistBonus_p90", weight: 1.5, target: [0, 0.04, 0.18, 0.5] },
    { key: "passAccuracy", weight: 2.5, target: [0.6, 0.75, 0.86, 0.92] },
    { key: "progressivePasses_p90", weight: 1.4, target: [4, 7, 11, 17] },
    { key: "finalThirdPasses_p90", weight: 1.3, target: [3, 6, 9, 14] },
    { key: "throughPasses_p90", weight: 0.8, target: [0, 0.4, 0.9, 1.7] },
    { key: "keyPasses_p90", weight: 1.0, target: [0, 0.4, 1.0, 1.8] },
    ...getActionRules("MIDFIELDER"),
    { key: "duelWinPct", weight: 1.5, target: [0.32, 0.47, 0.64, 0.78] },
    { key: "recoveries_p90", weight: 1.5, target: [0.8, 3, 6, 10] },
    { key: "lossesOwnHalf_p90", weight: 2, target: [12, 8, 5, 2], inverted: true },
    { key: "fouls_p90", weight: 0.8, target: [7, 5, 3, 1.5], inverted: true },
    { key: "midCreation_p90", weight: 1.5, target: [0, 0.4, 1.0, 1.8] },
    { key: "midPassVolume_p90", weight: 1.5, target: [20, 30, 45, 60] }
  ],
  WINGER: [
    GOAL_BONUS_RULE,
    { key: "wingAssistBonus_p90", weight: 1.5, target: [0, 0.08, 0.25, 0.6] },
    { key: "xG_p90", weight: 1.5, target: [0.04, 0.18, 0.6, 1.0] },
    { key: "duelWinPct", weight: 1.2, target: [0.28, 0.45, 0.62, 0.78] },
    { key: "passAccuracy", weight: 1, target: [0.55, 0.7, 0.83, 0.9] },
    { key: "progressivePasses_p90", weight: 1.0, target: [3, 5, 8, 13] },
    { key: "finalThirdPasses_p90", weight: 0.8, target: [2, 4, 7, 11] },
    { key: "throughPasses_p90", weight: 1.1, target: [0, 0.4, 1.0, 2.0] },
    { key: "keyPasses_p90", weight: 1.2, target: [0, 0.4, 1.0, 2.0] },
    ...getActionRules("WINGER"),
    { key: "crossesAccurate_p90", weight: 0.8, target: [0, 0.4, 1.2, 2.2] },
    { key: "wingCreation_p90", weight: 1.5, target: [0, 0.6, 1.2, 2.0] },
    { key: "wingPassVolume_p90", weight: 1.2, target: [12, 22, 32, 42] }
  ],
  ATTACKER: [
    // Attackers always evaluate goal bonus (even with 0 goals) so the metric is visible.
    GOAL_BONUS_RULE,
    { key: "attAssistBonus_p90", weight: 2, target: [0, 0.08, 0.25, 0.6] },
    { key: "xG_p90", weight: 2, target: [0.08, 0.28, 0.7, 1.1] },
    { key: "shotsOnTarget_p90", weight: 1.5, target: [0.25, 0.8, 1.6, 3] },
    { key: "duelWinPct", weight: 1, target: [0.25, 0.45, 0.63, 0.78] },
    { key: "passAccuracy", weight: 0.8, target: [0.55, 0.7, 0.83, 0.9] },
    { key: "throughPasses_p90", weight: 0.8, target: [0, 0.3, 0.8, 1.6] },
    { key: "keyPasses_p90", weight: 1.0, target: [0, 0.3, 0.8, 1.6] },
    ...getActionRules("ATTACKER"),
    { key: "attCreation_p90", weight: 1.5, target: [0, 0.4, 1.0, 1.8] },
    { key: "attPassVolume_p90", weight: 0.6, target: [8, 12, 18, 26] }
  ]
};
  
const DEFAULT_RULES = [
  { key: "passAccuracy", weight: 2, target: [0.55, 0.7, 0.83, 0.9] },
  { key: "duelWinPct", weight: 2, target: [0.3, 0.45, 0.63, 0.78] },
  { key: "progressivePasses_p90", weight: 0.8, target: [3, 5, 8, 13] },
  { key: "keyPasses_p90", weight: 0.8, target: [0, 0.3, 0.8, 1.6] },
  ...getActionRules("DEFAULT"),
  { key: "lossesOwnHalf_p90", weight: 1, target: [12, 8, 5, 2], inverted: true },
  { key: "fouls_p90", weight: 0.5, target: [7, 5, 3, 1.5], inverted: true }
];

function per90(val, minutes) {
  const m = Number(minutes) || 0;
  if (!m) return null;
  return (Number(val) || 0) * 90 / m;
}

function resolveMetric({ key, raw, minutes, role }) {
  const passes = Number(raw.passes) || 0;
  const passesSuccess = raw.passesSuccess ?? raw.accuratePasses;
  const forwardPasses = raw.forwardPasses != null ? Number(raw.forwardPasses) : null;
  const forwardPassesSuccess = raw.forwardPassesSuccess ?? raw.forwardPassesAccurate;
  const progressivePasses = raw.progressivePasses != null ? Number(raw.progressivePasses) : null;
  const progressivePassesSuccess = raw.progressivePassesSuccess ?? raw.progressivePassesAccurate;
  const finalThirdPasses = raw.passesFinalThird != null ? Number(raw.passesFinalThird) : null;
  const finalThirdPassesSuccess = raw.passesFinalThirdSuccess ?? raw.passesFinalThirdAccurate;
  const throughPasses = raw.throughPasses != null ? Number(raw.throughPasses) : null;
  const throughPassesSuccess = raw.throughPassesSuccess ?? raw.throughPassesAccurate;
  const duels = Number(raw.duels) || 0;
  const duelsSuccess = Number(raw.duelsSuccess) || 0;
  const defensiveDuels = raw.defensiveDuels != null ? Number(raw.defensiveDuels) : null;
  const defensiveDuelsSuccess = raw.defensiveDuelsSuccess ?? raw.defensiveDuelsWon;
  const offensiveDuels = raw.offensiveDuels != null ? Number(raw.offensiveDuels) : null;
  const offensiveDuelsSuccess = raw.offensiveDuelsSuccess ?? raw.offensiveDuelsWon;
  const aerialDuels = Number(raw.aerialDuels) || 0;
  const aerialDuelsSuccess = Number(raw.aerialDuelsSuccess) || 0;
  const crossesSuccess = Number(raw.crossesSuccess) || 0;
  const shotsSuccess = raw.shotsSuccess ?? raw.shotsOnTarget;
  const keyPasses = raw.keyPasses ?? raw.shotAssists;
  const lossesOwnHalf = raw.lossesSuccess ?? raw.lossesOwnHalf;
  const goals = raw.goals != null ? Number(raw.goals) : null;
  const assists = raw.assists != null ? Number(raw.assists) : null;
  const totalActions = raw.totalActions != null ? Number(raw.totalActions) : null;
  const successfulActions = raw.successfulActions != null ? Number(raw.successfulActions) : null;

  switch (key) {
    case "passAccuracy":
      return passesSuccess != null ? (passes ? passesSuccess / passes : 0) : null;
    case "forwardPassAccuracy":
      return forwardPassesSuccess != null
        ? (forwardPasses ? forwardPassesSuccess / forwardPasses : 0)
        : null;
    case "progressivePassAccuracy":
      return progressivePassesSuccess != null
        ? (progressivePasses ? progressivePassesSuccess / progressivePasses : 0)
        : null;
    case "finalThirdPassAccuracy":
      return finalThirdPassesSuccess != null
        ? (finalThirdPasses ? finalThirdPassesSuccess / finalThirdPasses : 0)
        : null;
    case "throughPassAccuracy":
      return throughPassesSuccess != null
        ? (throughPasses ? throughPassesSuccess / throughPasses : 0)
        : null;
    case "duelWinPct":
      return duels ? duelsSuccess / duels : null;
    case "defensiveDuelWinPct":
      return defensiveDuels ? (defensiveDuelsSuccess || 0) / defensiveDuels : null;
    case "offensiveDuelWinPct":
      return offensiveDuels ? (offensiveDuelsSuccess || 0) / offensiveDuels : null;
    case "aerialDuelWinPct":
      return aerialDuels ? aerialDuelsSuccess / aerialDuels : null;
    case "lossesOwnHalf_p90":
      return lossesOwnHalf != null ? per90(lossesOwnHalf, minutes) : null;
    case "clearances_p90":
      return raw.clearances != null ? per90(raw.clearances, minutes) : null;
    case "interceptions_p90":
      return raw.interceptions != null ? per90(raw.interceptions, minutes) : null;
    case "recoveries_p90":
      return raw.recoveries != null ? per90(raw.recoveries, minutes) : null;
    case "crossesAccurate_p90":
      return per90(crossesSuccess, minutes);
    case "forwardPasses_p90":
      return forwardPasses != null ? per90(forwardPasses, minutes) : null;
    case "progressivePasses_p90":
      return progressivePasses != null ? per90(progressivePasses, minutes) : null;
    case "finalThirdPasses_p90":
      return finalThirdPasses != null ? per90(finalThirdPasses, minutes) : null;
    case "throughPasses_p90":
      return throughPasses != null ? per90(throughPasses, minutes) : null;
    case "keyPasses_p90":
      return keyPasses != null ? per90(keyPasses, minutes) : null;
    case "defensiveDuels_p90":
      return defensiveDuels != null ? per90(defensiveDuels, minutes) : null;
    case "offensiveDuels_p90":
      return offensiveDuels != null ? per90(offensiveDuels, minutes) : null;
    case "shotsOnTarget_p90":
      return shotsSuccess != null ? per90(shotsSuccess, minutes) : null;
    case "shotAssists_p90":
      return keyPasses != null ? per90(keyPasses, minutes) : null;
    case "goals_p90":
      return goals != null ? per90(goals, minutes) : null;
    case "midGoals_p90":
      // Do not penalize if no goals; skip metric when zero
      if (goals == null || goals <= 0) return null;
      return per90(goals, minutes);
    case "xG_p90":
      return raw.xG != null ? per90(raw.xG, minutes) : null;
    case "xA_p90":
      return raw.xA != null ? per90(raw.xA, minutes) : null;
    case "actions_p90":
      return totalActions != null ? per90(totalActions, minutes) : null;
    case "actionSuccessRate":
      if (totalActions == null || successfulActions == null || totalActions <= 0) return null;
      return successfulActions / totalActions;
    case "goalBonus_p90": {
      const isAttacker = role === "ATTACKER";
      if (!isAttacker && (goals == null || goals <= 0)) return null;
      return per90(goals || 0, minutes);
    }
    case "cbAssistBonus_p90":
    case "fbAssistBonus_p90":
    case "midAssistBonus_p90":
    case "wingAssistBonus_p90":
    case "attAssistBonus_p90":
      if (assists == null || assists <= 0) return null;
      return per90(assists, minutes);
    case "midCreation_p90":
    case "fbCreation_p90":
    case "wingCreation_p90":
    case "attCreation_p90": {
      const kp = keyPasses != null ? per90(keyPasses, minutes) : null;
      const xa = raw.xA != null ? per90(raw.xA, minutes) : null;
      const best = Math.max(kp || 0, xa || 0);
      return best > 0 ? best : null;
    }
    case "midPassVolume_p90":
    case "fbPassVolume_p90":
    case "wingPassVolume_p90":
    case "attPassVolume_p90": {
      const vol = per90(passes, minutes);
      if (vol == null) return null;
      const minNeeded = {
        midPassVolume_p90: 25,
        fbPassVolume_p90: 20,
        wingPassVolume_p90: 15,
        attPassVolume_p90: 10
      }[key] ?? 10;
      return vol >= minNeeded ? vol : null; // reward only when volume is meaningful
    }
    default:
      return null;
  }
}

function score(val, [a, b, c, d], inverted = false) {
  if (val == null || Number.isNaN(val)) return null;
  let pct;
  if (!inverted) {
    if (val <= a) pct = 0;
    else if (val >= d) pct = 1;
    else if (val <= b) pct = (val - a) / (b - a) * 0.4;
    else if (val <= c) pct = 0.4 + (val - b) / (c - b) * 0.35;
    else pct = 0.75 + (val - c) / (d - c) * 0.25;
  } else {
    if (val >= a) pct = 0;
    else if (val <= d) pct = 1;
    else if (val >= b) pct = (a - val) / (a - b) * 0.4;
    else if (val >= c) pct = 0.4 + (b - val) / (b - c) * 0.35;
    else pct = 0.75 + (c - val) / (c - d) * 0.25;
  }
  return clamp(pct * 100);
}

export function gradeGame({ role, rawStats = {}, minutes = 0 }) {
  const rules = ROLE_RULES[role] || DEFAULT_RULES;
  let total = 0;
  let weightSum = 0;
  const breakdown = {};

  for (const rule of rules) {
    const val = resolveMetric({ key: rule.key, raw: rawStats, minutes, role });
    if (val == null) continue;
    const sc = score(val, rule.target, rule.inverted);
    if (sc == null) continue;
    breakdown[rule.key] = Math.round(sc);
    const w = rule.weight || 1;
    total += sc * w;
    weightSum += w;
  }

  let overall100 = null;
  if (!weightSum) {
    const hasAnyStat = rawStats && Object.keys(rawStats).length > 0;
    if (!hasAnyStat) {
      return { overall10: null, overall100: null, breakdown: {} };
    }
    // Fallback neutral grade when stats are present but none matched rules
    overall100 = 50;
  } else {
    overall100 = clamp(total / weightSum);
  }

  const yellowCards = Number(rawStats.yellowCards || 0);
  const redCards = Number(rawStats.redCards || 0);
  const cardPenalty = (yellowCards * CARD_PENALTIES.yellow) + (redCards * CARD_PENALTIES.red);
  if (cardPenalty > 0) {
    breakdown.cardPenalty = -cardPenalty;
    overall100 = clamp(overall100 - cardPenalty);
  }

  const overall10 = Math.max(1, Math.round(overall100) / 10); // floor to 1.0

  return { overall10, overall100: Math.round(overall100), breakdown };
}