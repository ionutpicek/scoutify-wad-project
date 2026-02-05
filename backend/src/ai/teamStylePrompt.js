import OpenAI from "openai";

const MODEL_NAME = "gpt-5.2";
let openai = null;

const getOpenAI = () => {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key) {
      console.log("OpenAI API key: Configured");
      openai = new OpenAI({ apiKey: key });
    } else {
      console.log("OpenAI API key: Not configured");
    }
  }
  return openai;
};

const INSIGHT_CATEGORIES = [
  "Possession",
  "Passing",
  "Pressing",
  "Finishing",
  "Strengths",
  "Weaknesses"
];

const toNumber = value => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/%/g, "").trim();
    if (cleaned === "") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && typeof value.toNumber === "function") {
    const numeric = value.toNumber();
    return toNumber(numeric);
  }
  return null;
};

const createAccumulator = () => ({ sum: 0, count: 0 });

const pushValue = (acc, value) => {
  const num = toNumber(value);
  if (num == null) return;
  acc.sum += num;
  acc.count += 1;
};

const average = acc => (acc.count ? acc.sum / acc.count : null);

const safeName = value => String(value || "").toLowerCase().trim();

const parseDateValue = raw => {
  if (!raw) return null;
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    const date = raw.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseScore = match => {
  if (!match) return null;
  const { homeGoals, awayGoals, score } = match;
  if (typeof homeGoals === "number" && typeof awayGoals === "number") {
    return { home: homeGoals, away: awayGoals };
  }
  if (typeof score === "string") {
    const found = score.match(/(\d+)\s*-\s*(\d+)/);
    if (found) {
      return {
        home: Number(found[1]),
        away: Number(found[2])
      };
    }
  }
  return null;
};

export const identifyTeamSide = (match, teamId, teamName) => {
  const launchId = id => id != null && teamId != null && String(id) === String(teamId);
  const normalizedTeamName = safeName(teamName);
  const nameMatches = name => normalizedTeamName && safeName(name) === normalizedTeamName;

  const homeIdFields = [match?.homeTeamId, match?.hometeamID, match?.homeTeam?.teamID, match?.homeTeam?.id];
  const awayIdFields = [match?.awayTeamId, match?.awayteamID, match?.awayTeam?.teamID, match?.awayTeam?.id];

  if (teamId && homeIdFields.some(id => launchId(id))) {
    return { side: "home", teamStats: match?.teamStats?.home, opponentStats: match?.teamStats?.away };
  }
  if (teamId && awayIdFields.some(id => launchId(id))) {
    return { side: "away", teamStats: match?.teamStats?.away, opponentStats: match?.teamStats?.home };
  }
  if (nameMatches(match?.homeTeam)) {
    return { side: "home", teamStats: match?.teamStats?.home, opponentStats: match?.teamStats?.away };
  }
  if (nameMatches(match?.awayTeam)) {
    return { side: "away", teamStats: match?.teamStats?.away, opponentStats: match?.teamStats?.home };
  }
  return null;
};

const formatDateLabel = date => {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatPct = (value, digits = 1) => (value == null ? null : `${value.toFixed(digits)}%`);
const formatNumber = (value, digits = 1) => (value == null ? null : value.toFixed(digits));

const formatMinutes = seconds => {
  if (seconds == null) return null;
  const minutes = seconds / 60;
  return `${minutes.toFixed(minutes >= 10 ? 0 : 1)}m`;
};

const formatPpt = value => {
  if (value == null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} ppt`;
};

const buildAiPrompt = ({ teamName, dateLabel, results, matchesCount, metrics }) => {
  const record = results ? `${results.wins}W-${results.draws}D-${results.losses}L` : "N/A";
  return `
Return ONLY JSON that matches the schema:
{
  "summaryText": string,
  "insights": [
    { "title": "Possession", "copy": string },
    { "title": "Passing", "copy": string },
    { "title": "Pressing", "copy": string },
    { "title": "Finishing", "copy": string },
    { "title": "Strengths", "copy": string },
    { "title": "Weaknesses", "copy": string }
  ],
  "cue": string
}

TEAM CONTEXT:
name=${teamName || "This team"}
matches=${matchesCount}
record=${record}
date_range=${dateLabel || "N/A"}

AGGREGATED METRICS (averages across matches, null means unavailable):
${JSON.stringify(metrics, null, 2)}

Guidelines:
- Provide 1-2 sentences per insight. Use the data; avoid generic filler.
- If data is missing for a category, acknowledge the gap and describe what is still visible.
- Strengths should highlight 1-2 clear statistical edges; Weaknesses should note 1-2 measurable gaps.
- SummaryText should be 2-3 sentences that blend results with style indicators.
- Cue should be one actionable coaching instruction based on the metrics.
- Keep the insight titles exactly as listed and return them in that order.
- Do not include markdown or extra keys.
  `.trim();
};

const parseAiJson = raw => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch (err) {
        return null;
      }
    }
    return null;
  }
};

const buildInsightCopy = parts => {
  const filtered = parts.filter(Boolean);
  if (!filtered.length) {
    return "Not enough data yet to describe this category.";
  }
  return `${filtered.join(". ")}.`;
};

const buildStrengthWeaknessCopy = (metrics, mode) => {
  const picks = [];
  const addPick = (condition, text) => {
    if (!condition || picks.length >= 2) return;
    picks.push(text);
  };

  if (mode === "strength") {
    addPick(metrics.possessionAvg != null && metrics.possessionAvg >= 55, "Controls possession phases consistently");
    addPick(metrics.passAccuracyPct != null && metrics.passAccuracyPct >= 84, "Builds play with clean, high-accuracy passing");
    addPick(metrics.longPassShareAvg != null && metrics.longPassShareAvg >= 34, "Comfortable switching play to progress quickly");
    addPick(metrics.ppdaAvg != null && metrics.ppdaAvg <= 9, "Sets the tone with proactive pressing");
    addPick(metrics.recoveriesAvg != null && metrics.recoveriesAvg >= 12, "Strong ball recovery volume fuels transitions");
    addPick(metrics.xgDiff != null && metrics.xgDiff >= 0.25, "Creates better chances than it concedes");
    addPick(metrics.shotAccuracyPct != null && metrics.shotAccuracyPct >= 36, "Shots-on-target rate is a consistent edge");
    addPick(metrics.goalsForAvg != null && metrics.goalsForAvg >= 1.6, "Finishes at a strong goals-per-match clip");
  } else {
    addPick(metrics.possessionAvg != null && metrics.possessionAvg <= 45, "Struggles to keep sustained possession");
    addPick(metrics.passAccuracyPct != null && metrics.passAccuracyPct <= 78, "Passing accuracy dips in buildup phases");
    addPick(metrics.longPassShareAvg != null && metrics.longPassShareAvg <= 20, "Limited long distribution to stretch opponents");
    addPick(metrics.ppdaAvg != null && metrics.ppdaAvg >= 13, "Pressing arrives late, allowing exits");
    addPick(metrics.recoveriesAvg != null && metrics.recoveriesAvg <= 9, "Recovery volume is low compared with the league standard");
    addPick(metrics.xgDiff != null && metrics.xgDiff <= -0.2, "Concedes higher-quality chances than it creates");
    addPick(metrics.shotAccuracyPct != null && metrics.shotAccuracyPct <= 30, "Shot accuracy is below target");
    addPick(metrics.goalsAgainstAvg != null && metrics.goalsAgainstAvg >= 1.6, "Concedes too often to stay in control");
  }

  if (picks.length) {
    return buildInsightCopy(picks);
  }

  return mode === "strength"
    ? "Balanced profile without a standout statistical edge yet."
    : "No clear statistical red flags yet; sample may be limited.";
};

const buildFallbackInsightCopy = (title, metrics) => {
  switch (title) {
    case "Possession": {
      const parts = [];
      const possession = formatPct(metrics.possessionAvg);
      if (possession != null) parts.push(`Avg possession ${possession}`);
      const trend = formatPpt(metrics.possessionTrend);
      if (trend != null) parts.push(`Trend ${trend}`);
      const spell = formatMinutes(metrics.avgPossessionDurationAvg);
      if (spell != null) parts.push(`Avg control spell ${spell}`);
      const deadTime = formatMinutes(metrics.deadTimeAvg);
      if (deadTime != null) parts.push(`Dead time ${deadTime}`);
      return buildInsightCopy(parts);
    }
    case "Passing": {
      const parts = [];
      const passAcc = formatPct(metrics.passAccuracyPct);
      if (passAcc != null) parts.push(`Pass accuracy ${passAcc}`);
      const longShare = formatPct(metrics.longPassShareAvg);
      if (longShare != null) parts.push(`Long pass share ${longShare}`);
      const passesAvg = formatNumber(metrics.passesAvg, 0);
      if (passesAvg != null) parts.push(`Passes per match ${passesAvg}`);
      return buildInsightCopy(parts);
    }
    case "Pressing": {
      const parts = [];
      const ppda = formatNumber(metrics.ppdaAvg);
      if (ppda != null) parts.push(`PPDA ${ppda}`);
      const recoveries = formatNumber(metrics.recoveriesAvg);
      if (recoveries != null) parts.push(`Recoveries per match ${recoveries}`);
      const oppRecoveries = formatNumber(metrics.opponentRecoveriesAvg);
      if (oppRecoveries != null) parts.push(`Opponent-half recoveries ${oppRecoveries}`);
      return buildInsightCopy(parts);
    }
    case "Finishing": {
      const parts = [];
      const shots = formatNumber(metrics.shotsAvg);
      if (shots != null) parts.push(`Shots per match ${shots}`);
      const shotAcc = formatPct(metrics.shotAccuracyPct, 0);
      if (shotAcc != null) parts.push(`Shot accuracy ${shotAcc}`);
      const xgDiff = formatNumber(metrics.xgDiff, 2);
      if (xgDiff != null) parts.push(`xG diff ${xgDiff}`);
      const goalsFor = formatNumber(metrics.goalsForAvg, 2);
      if (goalsFor != null) parts.push(`Goals for per match ${goalsFor}`);
      const goalsAgainst = formatNumber(metrics.goalsAgainstAvg, 2);
      if (goalsAgainst != null) parts.push(`Goals against per match ${goalsAgainst}`);
      return buildInsightCopy(parts);
    }
    case "Strengths":
      return buildStrengthWeaknessCopy(metrics, "strength");
    case "Weaknesses":
      return buildStrengthWeaknessCopy(metrics, "weakness");
    default:
      return "Not enough data yet to describe this category.";
  }
};

const buildFallbackSummary = ({ teamName, dateLabel, results, metrics }) => {
  const baseName = teamName || "This team";
  const record = results ? `${results.wins}W-${results.draws}D-${results.losses}L` : null;
  const headerParts = [baseName, record ? `(${record})` : null, dateLabel ? `(${dateLabel})` : null].filter(Boolean);
  const statParts = [];
  const possession = formatPct(metrics.possessionAvg);
  if (possession != null) statParts.push(`Possession avg ${possession}`);
  const passAcc = formatPct(metrics.passAccuracyPct);
  if (passAcc != null) statParts.push(`Pass accuracy ${passAcc}`);
  const ppda = formatNumber(metrics.ppdaAvg);
  if (ppda != null) statParts.push(`PPDA ${ppda}`);
  const xgDiff = formatNumber(metrics.xgDiff, 2);
  if (xgDiff != null) statParts.push(`xG diff ${xgDiff}`);
  const shots = formatNumber(metrics.shotsAvg);
  if (shots != null) statParts.push(`Shots per match ${shots}`);
  const summaryTail = statParts.length ? `${statParts.join(". ")}.` : "Not enough aggregated data yet.";
  const summaryText = `${headerParts.join(" ")} ${summaryTail}`.replace(/\s+/g, " ").trim();
  const insights = INSIGHT_CATEGORIES.map(title => ({
    title,
    copy: buildFallbackInsightCopy(title, metrics)
  }));
  const cue = "Review the sample and target the metric that is furthest from the team standard.";
  return { summaryText, insights, cue };
};

const normalizeInsights = (insights, fallbackInsights) => {
  const byTitle = new Map();
  if (Array.isArray(insights)) {
    insights.forEach(item => {
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      const copy = typeof item?.copy === "string" ? item.copy.trim() : "";
      if (title && copy) {
        byTitle.set(title.toLowerCase(), { title, copy });
      }
    });
  }
  return INSIGHT_CATEGORIES.map(title => {
    const key = title.toLowerCase();
    if (byTitle.has(key)) {
      return { title, copy: byTitle.get(key).copy };
    }
    const fallback = fallbackInsights.find(item => item.title === title);
    return fallback || { title, copy: "Not enough data yet to describe this category." };
  });
};

const normalizeAiSummary = (payload, fallback) => {
  const summaryText =
    typeof payload?.summaryText === "string" && payload.summaryText.trim()
      ? payload.summaryText.trim()
      : fallback.summaryText;
  const cue =
    typeof payload?.cue === "string" && payload.cue.trim()
      ? payload.cue.trim()
      : fallback.cue;
  const insights = normalizeInsights(payload?.insights, fallback.insights);
  return { summaryText, insights, cue };
};

const buildHighlights = ({
  possessionAvg,
  passAccuracyPct,
  ppdaAvg,
  xgDiff,
  shotsAvg,
  shotAccuracyPct,
  recoveriesAvg,
  goalsForAvg,
  goalsAgainstAvg,
  attacksAvg
}) => {
  const highlights = [];
  if (possessionAvg != null) {
    highlights.push({ label: "Possession", value: formatPct(possessionAvg), note: `avg %` });
  }
  if (passAccuracyPct != null) {
    highlights.push({ label: "Pass acc.", value: formatPct(passAccuracyPct), note: "short builds" });
  }
  if (ppdaAvg != null) {
    highlights.push({ label: "PPDA", value: formatNumber(ppdaAvg), note: "press intensity" });
  }
  if (recoveriesAvg != null) {
    highlights.push({ label: "Recoveries", value: formatNumber(recoveriesAvg), note: "per match" });
  }
  if (xgDiff != null) {
    highlights.push({ label: "xG diff", value: formatNumber(xgDiff, 2), note: "per match" });
  }
  if (goalsForAvg != null) {
    const note =
      goalsAgainstAvg != null
        ? `vs ${formatNumber(goalsAgainstAvg)} conceded`
        : "goals/match";
    highlights.push({ label: "Goals/match", value: formatNumber(goalsForAvg, 2), note });
  }
  if (shotsAvg != null) {
    const note = shotAccuracyPct != null ? `${shotAccuracyPct.toFixed(0)}% on target` : "";
    highlights.push({ label: "Shots/match", value: formatNumber(shotsAvg), note });
  }
  if (attacksAvg != null) {
    highlights.push({ label: "Attacks", value: formatNumber(attacksAvg), note: "per match" });
  }
  return highlights;
};

const generateTeamStyleSummary = async ({ teamName, dateLabel, results, matchesCount, metrics }) => {
  const fallback = buildFallbackSummary({ teamName, dateLabel, results, metrics });
  const client = getOpenAI();
  if (!client) {
    return fallback;
  }
  const prompt = buildAiPrompt({ teamName, dateLabel, results, matchesCount, metrics });

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: "You are a professional football scout. Keep insights structured, clear and data-driven."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.35
    });

    const message = response?.choices?.[0]?.message?.content?.trim();
    const parsed = parseAiJson(message);
    if (!parsed) return fallback;
    return normalizeAiSummary(parsed, fallback);
  } catch (error) {
    console.warn("AI team style summary failed, falling back:", error.message || error);
    return fallback;
  }
};

export async function buildTeamStylePrompt({
  matches = [],
  teamId,
  teamName,
  maxMatches = 10
} = {}) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      matchesConsidered: 0,
      summaryText: "No matches available to build a style of play yet.",
      highlights: [],
      insights: [],
      cue: "Upload or tag at least one match for this team to enable the summary."
    };
  }

  const sorted = [...matches].sort((a, b) => {
    const aDate = parseDateValue(a?.date);
    const bDate = parseDateValue(b?.date);
    if (aDate && bDate) return bDate - aDate;
    if (aDate) return -1;
    if (bDate) return 1;
    return 0;
  });

  const contexts = [];
  for (const match of sorted) {
    if (contexts.length >= maxMatches) break;
    const context = identifyTeamSide(match, teamId, teamName);
    if (!context) continue;
    const dateValue = parseDateValue(match?.date);
    contexts.push({
      match,
      dateValue,
      ...context
    });
  }

  if (!contexts.length) {
    return {
      matchesConsidered: 0,
      summaryText: "No recent matches for this team yet.",
      highlights: [],
      insights: [],
      cue: "Bring in a match PDF or assign this team to an existing game."
    };
  }

  const accum = {
    possession: createAccumulator(),
    passes: createAccumulator(),
    passesAccurate: createAccumulator(),
    longPassShare: createAccumulator(),
    ppda: createAccumulator(),
    recoveries: createAccumulator(),
    opponentRecoveries: createAccumulator(),
    purePossession: createAccumulator(),
    avgPossessionDuration: createAccumulator(),
    deadTime: createAccumulator(),
    shots: createAccumulator(),
    shotsOnTarget: createAccumulator(),
    corners: createAccumulator(),
    xG: createAccumulator(),
    xGAgainst: createAccumulator(),
    duels: createAccumulator(),
    duelsWon: createAccumulator(),
    attacks: createAccumulator()
  };

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;
  let totalGoalDiff = 0;

  const accumulateTeamStats = (teamStats, side) => {
    if (!teamStats) return;
    pushValue(accum.possession, teamStats.possessionPct);
    pushValue(accum.longPassShare, teamStats.longPassSharePct);
    pushValue(accum.ppda, teamStats.ppda);
    pushValue(accum.recoveries, teamStats.recoveries);
    pushValue(accum.opponentRecoveries, teamStats.opponentHalfRecoveries);
    pushValue(accum.purePossession, teamStats.purePossessionSec);
    pushValue(accum.avgPossessionDuration, teamStats.avgPossessionDurationSec);
    pushValue(accum.deadTime, teamStats.deadTimeSec);
    pushValue(accum.shots, teamStats.shots);
    pushValue(accum.shotsOnTarget, teamStats.shotsOnTarget);
    pushValue(accum.corners, teamStats.corners);
    pushValue(accum.xG, teamStats.xG);
    pushValue(accum.duels, teamStats.duels);
    pushValue(accum.duelsWon, teamStats.duelsWon);
    pushValue(accum.attacks, teamStats.attacks);
    pushValue(accum.passes, teamStats.passes);
    pushValue(accum.passesAccurate, teamStats.passesAccurate);
    if (side === "home" && teamStats?.xG != null && teamStats?.xGAgainst == null) {
      pushValue(accum.xGAgainst, teamStats.xGAgainst);
    }
  };

  contexts.forEach(context => {
    const { match, teamStats, opponentStats, side } = context;
    accumulateTeamStats(teamStats, side);
    if (opponentStats) {
      pushValue(accum.xGAgainst, opponentStats.xG);
    }
    const goals = parseScore(match);
    const teamGoals = goals ? (side === "home" ? goals.home : goals.away) : null;
    const opponentGoals = goals ? (side === "home" ? goals.away : goals.home) : null;
    if (teamGoals != null && opponentGoals != null) {
      totalGoalsFor += teamGoals;
      totalGoalsAgainst += opponentGoals;
      const diff = teamGoals - opponentGoals;
      totalGoalDiff += diff;
      if (diff > 0) wins += 1;
      else if (diff === 0) draws += 1;
      else losses += 1;
    }
  });

  const matchesCount = contexts.length;
  const possessionAvg = average(accum.possession);
  const longPassShareAvg = average(accum.longPassShare);
  const ppdaAvg = average(accum.ppda);
  const recoveriesAvg = average(accum.recoveries);
  const purePossessionAvg = average(accum.purePossession);
  const avgPossessionDurationAvg = average(accum.avgPossessionDuration);
  const deadTimeAvg = average(accum.deadTime);
  const shotsAvg = average(accum.shots);
  const shotsOnTargetAvg = average(accum.shotsOnTarget);
  const shotAccuracyPct = shotsAvg && shotsOnTargetAvg ? (shotsOnTargetAvg / shotsAvg) * 100 : null;
  const cornersAvg = average(accum.corners);
  const passesSum = accum.passes.sum;
  const passAccuracyPct = passesSum ? (accum.passesAccurate.sum / passesSum) * 100 : null;
  const xGAvg = average(accum.xG);
  const xGAgainstAvg = average(accum.xGAgainst);
  const xgDiff = xGAvg != null && xGAgainstAvg != null ? xGAvg - xGAgainstAvg : null;
  const duelsAvg = average(accum.duels);
  const duelsWonAvg = average(accum.duelsWon);
  const attacksAvg = average(accum.attacks);

  const firstContext = contexts[contexts.length - 1];
  const lastContext = contexts[0];
  const firstPossession = firstContext ? toNumber(firstContext.teamStats?.possessionPct) : null;
  const lastPossession = lastContext ? toNumber(lastContext.teamStats?.possessionPct) : null;
  const possessionTrend = firstPossession != null && lastPossession != null ? lastPossession - firstPossession : null;

  const dateLabel = (() => {
    const start = firstContext?.dateValue;
    const end = lastContext?.dateValue;
    if (start && end) {
      return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
    }
    return start ? formatDateLabel(start) : end ? formatDateLabel(end) : "";
  })();

  const passesAvg = average(accum.passes);
  const opponentRecoveriesAvg = average(accum.opponentRecoveries);
  const goalsForAvg = matchesCount ? totalGoalsFor / matchesCount : null;
  const goalsAgainstAvg = matchesCount ? totalGoalsAgainst / matchesCount : null;

  const metrics = {
    possessionAvg,
    possessionTrend,
    avgPossessionDurationAvg,
    deadTimeAvg,
    purePossessionAvg,
    passesAvg,
    passesSum,
    passAccuracyPct,
    longPassShareAvg,
    ppdaAvg,
    recoveriesAvg,
    opponentRecoveriesAvg,
    shotsAvg,
    shotsOnTargetAvg,
    shotAccuracyPct,
    xGAvg,
    xGAgainstAvg,
    xgDiff,
    goalsForAvg,
    goalsAgainstAvg,
    cornersAvg,
    duelsAvg,
    duelsWonAvg,
    attacksAvg
  };

  const highlights = buildHighlights({
    possessionAvg,
    passAccuracyPct,
    ppdaAvg,
    xgDiff,
    shotsAvg,
    shotAccuracyPct,
    recoveriesAvg,
    goalsForAvg,
    goalsAgainstAvg,
    attacksAvg
  });

  const aiSummary = await generateTeamStyleSummary({
    teamName,
    dateLabel,
    results: { wins, draws, losses },
    matchesCount,
    metrics
  });

  return {
    matchesConsidered: matchesCount,
    summaryText: aiSummary.summaryText,
    highlights,
    insights: aiSummary.insights,
    cue: aiSummary.cue,
    stats: {
      possessionAvg,
      passesSum,
      passAccuracyPct,
      xgDiff,
      shotsAvg,
      shotAccuracyPct,
      ppdaAvg,
      recoveriesAvg,
      deadTimeAvg,
      attacksAvg,
      duelsAvg,
      duelsWonAvg,
      cornersAvg,
      opponentRecoveriesAvg,
      goalsForAvg,
      goalsAgainstAvg
    }
  };
}

export default buildTeamStylePrompt;
