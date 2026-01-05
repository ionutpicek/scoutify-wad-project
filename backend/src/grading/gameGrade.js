// src/services/grading/gradeGame.js

const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));

// Unified goal bonus for all roles so scoring is rewarded consistently.
// Attackers still evaluate the metric even at 0 goals (so it's visible); other
// roles only score when they actually net a goal.
const GOAL_BONUS_RULE = { key: "goalBonus_p90", weight: 2, target: [0, 0.2, 0.7, 1.2] };

const ROLE_RULES = {
  CB: [
    GOAL_BONUS_RULE,
    { key: "duelWinPct", weight: 3, target: [0.3, 0.45, 0.6, 0.8] },
    { key: "aerialDuelWinPct", weight: 1.5, target: [0.25, 0.4, 0.55, 0.7] },
    { key: "passAccuracy", weight: 2, target: [0.55, 0.7, 0.82, 0.9] },
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
    { key: "aerialDuelWinPct", weight: 0.8, target: [0.2, 0.35, 0.5, 0.65] },
    { key: "passAccuracy", weight: 1.5, target: [0.58, 0.72, 0.84, 0.9] },
    { key: "crossesAccurate_p90", weight: 2, target: [0, 0.4, 1.2, 2.5] },
    { key: "lossesOwnHalf_p90", weight: 2, target: [12, 8, 5, 2], inverted: true },
    { key: "fouls_p90", weight: 0.8, target: [7, 5, 3, 1.5], inverted: true },
    { key: "interceptions_p90", weight: 1, target: [0.3, 1, 2, 3.5] },
    { key: "fbAssistBonus_p90", weight: 1.5, target: [0, 0.04, 0.15, 0.4] },
    { key: "fbCreation_p90", weight: 1.2, target: [0, 0.25, 0.7, 1.2] },
    { key: "fbPassVolume_p90", weight: 1.2, target: [16, 26, 38, 52] }
  ],
  MIDFIELDER: [
    GOAL_BONUS_RULE,
    // Bonuses; skipped when zero
    { key: "midAssistBonus_p90", weight: 1.5, target: [0, 0.04, 0.18, 0.5] },
    { key: "passAccuracy", weight: 2.5, target: [0.6, 0.75, 0.86, 0.92] },
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
    { key: "attCreation_p90", weight: 1.5, target: [0, 0.4, 1.0, 1.8] },
    { key: "attPassVolume_p90", weight: 0.6, target: [8, 12, 18, 26] }
  ]
};
  
const DEFAULT_RULES = [
  { key: "passAccuracy", weight: 2, target: [0.55, 0.7, 0.83, 0.9] },
  { key: "duelWinPct", weight: 2, target: [0.3, 0.45, 0.63, 0.78] },
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
  const duels = Number(raw.duels) || 0;
  const duelsSuccess = Number(raw.duelsSuccess) || 0;
  const aerialDuels = Number(raw.aerialDuels) || 0;
  const aerialDuelsSuccess = Number(raw.aerialDuelsSuccess) || 0;
  const crossesSuccess = Number(raw.crossesSuccess) || 0;
  const shotsSuccess = raw.shotsSuccess ?? raw.shotsOnTarget;
  const keyPasses = raw.keyPasses ?? raw.shotAssists;
  const lossesOwnHalf = raw.lossesSuccess ?? raw.lossesOwnHalf;
  const goals = raw.goals != null ? Number(raw.goals) : null;
  const assists = raw.assists != null ? Number(raw.assists) : null;

  switch (key) {
    case "passAccuracy":
      return passesSuccess != null ? (passes ? passesSuccess / passes : 0) : null;
    case "duelWinPct":
      return duels ? duelsSuccess / duels : null;
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

  if (!weightSum) {
    const hasAnyStat = rawStats && Object.keys(rawStats).length > 0;
    if (!hasAnyStat) {
      return { overall10: null, overall100: null, breakdown: {} };
    }
    // Fallback neutral grade when stats are present but none matched rules
    return { overall10: 5, overall100: 50, breakdown };
  }

  const overall100 = clamp(total / weightSum);
  const overall10 = Math.max(1, Math.round(overall100) / 10); // floor to 1.0

  return { overall10, overall100: Math.round(overall100), breakdown };
}