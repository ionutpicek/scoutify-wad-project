const METRIC_LABELS = {
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  shotsSuccess: "Shots on target",
  shotsOnTarget: "Shots on target",
  xG: "xG",
  xA: "xA",
  passes: "Passes",
  passesSuccess: "Accurate passes",
  keyPasses: "Key passes",
  progressivePasses: "Progressive passes",
  throughPasses: "Through passes",
  crosses: "Crosses",
  crossesSuccess: "Accurate crosses",
  duels: "Duels",
  duelsSuccess: "Duels won",
  defensiveDuels: "Defensive duels",
  defensiveDuelsSuccess: "Defensive duels won",
  offensiveDuels: "Offensive duels",
  offensiveDuelsSuccess: "Offensive duels won",
  aerialDuels: "Aerial duels",
  aerialDuelsSuccess: "Aerial duels won",
  interceptions: "Interceptions",
  recoveries: "Recoveries",
  recoveriesOppHalf: "Recoveries in opp half",
  lossesSuccess: "Losses in own half",
  fouls: "Fouls",
  yellowCards: "Yellow cards",
  redCards: "Red cards",
  shotsAgainst: "Shots against",
  saves: "Saves",
  concededGoals: "Goals conceded",
  xCG: "xCG",
  goalKicks: "Goal kicks",
  shortGoalKicks: "Short goal kicks",
  longGoalKicks: "Long goal kicks",
  passAccuracy: "Pass accuracy",
  forwardPassAccuracy: "Forward pass accuracy",
  progressivePassAccuracy: "Progressive pass accuracy",
  finalThirdPassAccuracy: "Final-third pass accuracy",
  throughPassAccuracy: "Through-pass accuracy",
  duelWinPct: "Duel win rate",
  defensiveDuelWinPct: "Defensive duel win rate",
  offensiveDuelWinPct: "Offensive duel win rate",
  lossesOwnHalf_p90: "Losses in own half /90",
  fouls_p90: "Fouls /90",
  recoveries_p90: "Recoveries /90",
  clearances_p90: "Clearances /90",
  interceptions_p90: "Interceptions /90",
  shotsOnTarget_p90: "Shots on target /90",
  xG_p90: "xG /90",
  goalBonus_p90: "Goal bonus /90",
  cardPenalty: "Discipline penalty"
};

const OUTFIELD_PRIORITY_KEYS = [
  "goals",
  "assists",
  "shots",
  "shotsSuccess",
  "xG",
  "xA",
  "keyPasses",
  "passes",
  "passesSuccess",
  "progressivePasses",
  "throughPasses",
  "duels",
  "duelsSuccess",
  "defensiveDuels",
  "defensiveDuelsSuccess",
  "offensiveDuels",
  "offensiveDuelsSuccess",
  "interceptions",
  "recoveries",
  "lossesSuccess",
  "fouls",
  "yellowCards",
  "redCards"
];

const GK_PRIORITY_KEYS = [
  "shotsAgainst",
  "saves",
  "concededGoals",
  "xCG",
  "passes",
  "passesSuccess",
  "goalKicks",
  "shortGoalKicks",
  "longGoalKicks",
  "fouls",
  "yellowCards",
  "redCards"
];

const normalizeText = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toLabelFromKey = key => {
  if (!key) return "";
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  const withSpaces = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const formatMetricValue = value => {
  if (value == null) return "-";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    if (Number.isInteger(value)) return String(value);
    return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
  }
  return String(value);
};

const toNumber = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const safePer90 = (value, minutes) => {
  const val = toNumber(value);
  const mins = toNumber(minutes);
  if (val == null || mins == null || mins <= 0) return null;
  return (val * 90) / mins;
};

const safePct = (success, total) => {
  const numerator = toNumber(success);
  const denominator = toNumber(total);
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
};

const formatRawMetric = (key, value) => {
  if (value == null) return null;
  const percentKeys = new Set([
    "passAccuracy",
    "forwardPassAccuracy",
    "progressivePassAccuracy",
    "finalThirdPassAccuracy",
    "throughPassAccuracy",
    "duelWinPct",
    "defensiveDuelWinPct",
    "offensiveDuelWinPct",
    "actionSuccessRate"
  ]);

  if (percentKeys.has(key)) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (key.endsWith("_p90")) {
    return `${value.toFixed(2)}/90`;
  }

  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
};

const getRawMetricValue = (entry, key) => {
  const stats = entry?.matchStats || {};
  const minutes = entry?.minutesPlayed ?? 0;

  const passes = toNumber(stats.passes);
  const passesSuccess = toNumber(stats.passesSuccess ?? stats.accuratePasses);
  const duels = toNumber(stats.duels);
  const duelsSuccess = toNumber(stats.duelsSuccess ?? stats.duelsWon);
  const defensiveDuels = toNumber(stats.defensiveDuels);
  const defensiveDuelsSuccess = toNumber(stats.defensiveDuelsSuccess ?? stats.defensiveDuelsWon);
  const offensiveDuels = toNumber(stats.offensiveDuels);
  const offensiveDuelsSuccess = toNumber(stats.offensiveDuelsSuccess ?? stats.offensiveDuelsWon);
  const totalActions = toNumber(stats.totalActions);
  const successfulActions = toNumber(stats.successfulActions);
  const lossesOwnHalf = toNumber(stats.lossesSuccess ?? stats.lossesOwnHalf);
  const keyPasses = toNumber(stats.keyPasses ?? stats.shotAssists);
  const xA = toNumber(stats.xA);
  const goals = toNumber(stats.goals);
  const xG = toNumber(stats.xG);
  const fouls = toNumber(stats.fouls);
  const recoveries = toNumber(stats.recoveries);
  const interceptions = toNumber(stats.interceptions);
  const clearances = toNumber(stats.clearances);
  const shotsOnTarget = toNumber(stats.shotsSuccess ?? stats.shotsOnTarget);

  switch (key) {
    case "passAccuracy":
      return safePct(passesSuccess, passes);
    case "duelWinPct":
      return safePct(duelsSuccess, duels);
    case "defensiveDuelWinPct":
      return safePct(defensiveDuelsSuccess, defensiveDuels);
    case "offensiveDuelWinPct":
      return safePct(offensiveDuelsSuccess, offensiveDuels);
    case "actionSuccessRate":
      return safePct(successfulActions, totalActions);
    case "actions_p90":
      return safePer90(totalActions, minutes);
    case "lossesOwnHalf_p90":
      return safePer90(lossesOwnHalf, minutes);
    case "fouls_p90":
      return safePer90(fouls, minutes);
    case "recoveries_p90":
      return safePer90(recoveries, minutes);
    case "interceptions_p90":
      return safePer90(interceptions, minutes);
    case "clearances_p90":
      return safePer90(clearances, minutes);
    case "shotsOnTarget_p90":
      return safePer90(shotsOnTarget, minutes);
    case "xG_p90":
      return safePer90(xG, minutes);
    case "goalBonus_p90":
      return safePer90(goals, minutes);
    case "midCreation_p90":
    case "fbCreation_p90":
    case "wingCreation_p90":
    case "attCreation_p90": {
      const keyPassesPer90 = safePer90(keyPasses, minutes);
      const xAPer90 = safePer90(xA, minutes);
      return Math.max(keyPassesPer90 || 0, xAPer90 || 0);
    }
    default:
      return null;
  }
};

const buildSignalItem = (entry, key, value) => {
  const rawValue = getRawMetricValue(entry, key);
  return {
    key,
    label: toLabelFromKey(key),
    score: Math.round(Number(value)),
    raw: formatRawMetric(key, rawValue)
  };
};

const isGkPlayer = entry => {
  const position = String(entry?.position || "").toUpperCase();
  const rolePlayed = String(entry?.rolePlayed || "").toUpperCase();
  return position === "GK" || rolePlayed === "GK";
};

const buildStatsRows = entry => {
  const stats = entry?.matchStats || {};
  const allKeys = Object.keys(stats).filter(key => stats[key] != null);
  if (!allKeys.length) return [];

  const priority = isGkPlayer(entry) ? GK_PRIORITY_KEYS : OUTFIELD_PRIORITY_KEYS;
  const seen = new Set();
  const ordered = [];

  priority.forEach(key => {
    if (stats[key] == null) return;
    seen.add(key);
    ordered.push(key);
  });

  allKeys
    .filter(key => !seen.has(key))
    .sort((a, b) => a.localeCompare(b))
    .forEach(key => ordered.push(key));

  return ordered.map(key => ({
    key,
    label: toLabelFromKey(key),
    value: formatMetricValue(stats[key]),
    rawValue: stats[key]
  }));
};

const buildFallbackInsights = entry => {
  const insights = [];
  const derived = entry?.derived || {};

  const savePct = typeof derived.savePct === "number" ? derived.savePct : null;
  const xcgDiff = typeof derived.xCG_diff_p90 === "number" ? derived.xCG_diff_p90 : null;
  const goalsConceded =
    typeof derived.goalsConceded_p90 === "number" ? derived.goalsConceded_p90 : null;

  if (savePct != null) {
    insights.push(`Save rate: ${(savePct * 100).toFixed(1)}%.`);
  }
  if (xcgDiff != null) {
    insights.push(
      xcgDiff >= 0
        ? `Shot-stopping added value: +${xcgDiff.toFixed(2)} xCG diff per 90.`
        : `Shot-stopping below expectation: ${xcgDiff.toFixed(2)} xCG diff per 90.`
    );
  }
  if (goalsConceded != null) {
    insights.push(`Goals conceded: ${goalsConceded.toFixed(2)} per 90.`);
  }

  return insights;
};

const buildGradeSummary = entry => {
  const overall10Raw = entry?.gameGrade?.overall10 ?? entry?.grade;
  const overall10 = overall10Raw != null ? Number(overall10Raw) : null;
  const overall100Raw = entry?.gameGrade?.overall100;
  const overall100 =
    overall100Raw != null && Number.isFinite(Number(overall100Raw))
      ? Number(overall100Raw)
      : overall10 != null
        ? Math.round(overall10 * 10)
        : null;

  const deltaRaw = entry?.delta;
  const delta = deltaRaw != null && Number.isFinite(Number(deltaRaw)) ? Number(deltaRaw) : null;

  const breakdown = entry?.gameGrade?.breakdown || {};
  const breakdownEntries = Object.entries(breakdown).filter(
    ([key, value]) => key !== "cardPenalty" && Number.isFinite(Number(value))
  );
  const rankedDesc = [...breakdownEntries].sort((a, b) => Number(b[1]) - Number(a[1]));
  const rankedAsc = [...breakdownEntries].sort((a, b) => Number(a[1]) - Number(b[1]));

  const strengths = rankedDesc.slice(0, 3).map(([key, value]) => buildSignalItem(entry, key, value));

  const improvements = rankedAsc.slice(0, 3).map(([key, value]) =>
    buildSignalItem(entry, key, value)
  );

  const cardPenalty =
    Number.isFinite(Number(breakdown.cardPenalty)) && Number(breakdown.cardPenalty) < 0
      ? Math.abs(Number(breakdown.cardPenalty))
      : null;

  let summary = "No game grade available for this match (usually low minutes or missing tracked stats).";
  if (overall10 != null) {
    const deltaText =
      delta == null
        ? ""
        : delta > 0
          ? ` (+${delta.toFixed(1)} vs season).`
          : ` (${delta.toFixed(1)} vs season).`;
    summary = `Game grade: ${overall10.toFixed(1)}/10${deltaText}`;
  }

  const fallbackInsights = !breakdownEntries.length ? buildFallbackInsights(entry) : [];

  return {
    overall10,
    overall100,
    delta,
    strengths,
    improvements,
    cardPenalty,
    summary,
    hasBreakdown: breakdownEntries.length > 0,
    fallbackInsights
  };
};

const findPlayerEntry = (players = [], user = null) => {
  if (!Array.isArray(players) || !players.length || !user) return null;

  const sessionPlayerId = user?.playerID != null ? String(user.playerID) : null;
  const sessionUsername = normalizeText(user?.username);

  return (
    players.find(player => {
      const candidatePlayerId =
        player?.playerId != null
          ? String(player.playerId)
          : player?.playerID != null
            ? String(player.playerID)
            : null;
      return sessionPlayerId != null && candidatePlayerId != null && candidatePlayerId === sessionPlayerId;
    }) ||
    players.find(player => {
      if (!sessionUsername) return false;
      const candidate = normalizeText(player?.canonicalName || player?.name || "");
      return candidate && candidate === sessionUsername;
    }) ||
    null
  );
};

export function buildPlayerReportFromEntry(entry = null) {
  if (!entry) return null;
  return {
    entry,
    statsRows: buildStatsRows(entry),
    grade: buildGradeSummary(entry)
  };
}

const teamOrder = entry => {
  const team = String(entry?.team || "").toLowerCase();
  if (team === "home") return 0;
  if (team === "away") return 1;
  return 2;
};

export function buildAllPlayerMatchReports(players = [], options = {}) {
  if (!Array.isArray(players) || !players.length) return [];
  const includeUnplayed = Boolean(options.includeUnplayed);

  return players
    .filter(player => player && (includeUnplayed || Number(player.minutesPlayed || 0) > 0))
    .map(buildPlayerReportFromEntry)
    .filter(Boolean)
    .sort((a, b) => {
      const teamDelta = teamOrder(a.entry) - teamOrder(b.entry);
      if (teamDelta !== 0) return teamDelta;

      const gradeA = Number(a?.grade?.overall10 ?? -1);
      const gradeB = Number(b?.grade?.overall10 ?? -1);
      if (gradeB !== gradeA) return gradeB - gradeA;

      const minsA = Number(a?.entry?.minutesPlayed || 0);
      const minsB = Number(b?.entry?.minutesPlayed || 0);
      if (minsB !== minsA) return minsB - minsA;

      const nameA = String(a?.entry?.canonicalName || a?.entry?.name || "");
      const nameB = String(b?.entry?.canonicalName || b?.entry?.name || "");
      return nameA.localeCompare(nameB);
    });
}

export function buildPlayerMatchReport(players = [], user = null) {
  const entry = findPlayerEntry(players, user);
  if (!entry) return null;
  return buildPlayerReportFromEntry(entry);
}
