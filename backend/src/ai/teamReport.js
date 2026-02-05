import OpenAI from "openai";
import { identifyTeamSide } from "./teamStylePrompt.js";

const MODEL_NAME = "gpt-5.2";
const SECTION_TITLES = [
  "In Possession",
  "Out of Possession",
  "Transitions",
  "Chance Creation and Finishing",
  "Set Pieces and Duels",
  "Squad and Game-State Notes"
];
const MAX_SUPPLEMENTS = 10;

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

const toNumber = value => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/%/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return toNumber(value.toNumber());
  }
  return null;
};

const createAccumulator = () => ({ sum: 0, count: 0 });

const pushValue = (acc, value) => {
  const numeric = toNumber(value);
  if (numeric == null) return;
  acc.sum += numeric;
  acc.count += 1;
};

const average = acc => (acc.count ? acc.sum / acc.count : null);

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
    if (!found) return null;
    return { home: Number(found[1]), away: Number(found[2]) };
  }
  return null;
};

const formatDateLabel = date => {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatPct = (value, digits = 1) => (value == null ? null : `${value.toFixed(digits)}%`);
const formatNumber = (value, digits = 1) => (value == null ? null : value.toFixed(digits));
const formatSigned = (value, digits = 2) => {
  if (value == null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
};

const getTeamLabel = value => {
  if (value == null) return "Unknown";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.name === "string" && value.name.trim()) return value.name.trim();
    if (typeof value.teamName === "string" && value.teamName.trim()) return value.teamName.trim();
  }
  return String(value);
};

const normalizeStringList = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
};

const parseAiJson = raw => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (err) {
      return null;
    }
  }
};

const buildSupplementSnapshot = supplementalInsights =>
  (Array.isArray(supplementalInsights) ? supplementalInsights : [])
    .slice(0, MAX_SUPPLEMENTS)
    .map(item => ({
      sourceName: item?.sourceName || "Unknown source",
      summary: item?.summary || "",
      tacticalThemes: normalizeStringList(item?.tacticalThemes).slice(0, 4),
      strengths: normalizeStringList(item?.strengths).slice(0, 3),
      weaknesses: normalizeStringList(item?.weaknesses).slice(0, 3),
      opponentPlanHints: normalizeStringList(item?.opponentPlanHints).slice(0, 3),
      keyNumbers: Array.isArray(item?.keyNumbers) ? item.keyNumbers.slice(0, 5) : []
    }));

const buildAiPrompt = ({
  teamName,
  matchesCount,
  dateRange,
  record,
  metrics,
  matchRows,
  supplementalInsights = []
}) => `
Return ONLY JSON that matches this schema:
{
  "reportTitle": string,
  "matchesAnalyzed": number,
  "executiveSummary": string,
  "keyMetrics": [
    { "label": string, "value": string, "whyItMatters": string }
  ],
  "sections": [
    {
      "title": "In Possession" | "Out of Possession" | "Transitions" | "Chance Creation and Finishing" | "Set Pieces and Duels" | "Squad and Game-State Notes",
      "findings": [string]
    }
  ],
  "strengths": [string],
  "weaknesses": [string],
  "opponentGamePlan": [string]
}

TEAM CONTEXT:
- Team: ${teamName || "This team"}
- Matches analyzed: ${matchesCount}
- Date range: ${dateRange || "N/A"}
- Record: ${record}

AGGREGATED METRICS (null means unavailable):
${JSON.stringify(metrics, null, 2)}

PER-MATCH SNAPSHOT (most recent first):
${JSON.stringify(matchRows, null, 2)}

SUPPLEMENTAL DOSSIER NOTES (AI-extracted from uploaded PDFs):
${JSON.stringify(buildSupplementSnapshot(supplementalInsights), null, 2)}

Rules:
- Keep output concise and scannable; no markdown, no extra keys.
- Merge evidence from match metrics and supplemental dossier notes where relevant.
- keyMetrics: 5 to 8 entries, each with clear tactical meaning.
- Include a set-piece metric (corners or dead-ball threat) when data exists.
- sections: include all 6 titles in the exact order above.
- findings: 2 to 4 points per section.
- strengths: 3 to 5 concrete points backed by metrics.
- weaknesses: 3 to 5 concrete points backed by metrics.
- opponentGamePlan: 3 to 5 actionable recommendations.
- matchesAnalyzed must equal ${matchesCount}.
`.trim();

const ensureSections = (sections, fallbackSections) => {
  const byTitle = new Map();
  if (Array.isArray(sections)) {
    sections.forEach(section => {
      const title = typeof section?.title === "string" ? section.title.trim() : "";
      const findings = normalizeStringList(section?.findings);
      if (!title || !findings.length) return;
      byTitle.set(title.toLowerCase(), { title, findings });
    });
  }

  return SECTION_TITLES.map(title => {
    const fromModel = byTitle.get(title.toLowerCase());
    if (fromModel) return { title, findings: fromModel.findings };
    const fallback = fallbackSections.find(section => section.title === title);
    return fallback || { title, findings: ["Insufficient data to expand this section yet."] };
  });
};

const getSetPieceMetric = metrics => {
  const corners = formatNumber(metrics?.cornersAvg);
  if (!corners) return null;
  return {
    label: "Set-piece impact",
    value: `${corners} corners/match`,
    whyItMatters: "Dead-ball volume is a stable chance source when open play is limited."
  };
};

const ensureSetPieceMetric = (keyMetrics, fallbackMetrics, metrics) => {
  const hasSetPiece = keyMetrics.some(item =>
    String(item?.label || "")
      .toLowerCase()
      .includes("set-piece")
  );
  if (hasSetPiece) return keyMetrics;

  const fromFallback = fallbackMetrics.find(item =>
    String(item?.label || "")
      .toLowerCase()
      .includes("set-piece")
  );
  const setPieceMetric = fromFallback || getSetPieceMetric(metrics);
  if (!setPieceMetric) return keyMetrics;

  if (keyMetrics.length < 8) {
    return [...keyMetrics, setPieceMetric];
  }

  const replaceIndex = keyMetrics.findIndex(item =>
    String(item?.label || "")
      .toLowerCase()
      .includes("goals for / against")
  );
  if (replaceIndex !== -1) {
    const next = [...keyMetrics];
    next[replaceIndex] = setPieceMetric;
    return next;
  }

  const next = [...keyMetrics];
  next[next.length - 1] = setPieceMetric;
  return next;
};

const normalizeReport = (payload, fallbackReport, matchesCount, supplementalInsights = [], metrics = {}) => {
  const reportTitle =
    typeof payload?.reportTitle === "string" && payload.reportTitle.trim()
      ? payload.reportTitle.trim()
      : fallbackReport.reportTitle;

  const executiveSummary =
    typeof payload?.executiveSummary === "string" && payload.executiveSummary.trim()
      ? payload.executiveSummary.trim()
      : fallbackReport.executiveSummary;

  const keyMetricsRaw =
    Array.isArray(payload?.keyMetrics) && payload.keyMetrics.length
      ? payload.keyMetrics
          .map(item => ({
            label: typeof item?.label === "string" ? item.label.trim() : "",
            value: typeof item?.value === "string" ? item.value.trim() : "",
            whyItMatters:
              typeof item?.whyItMatters === "string" ? item.whyItMatters.trim() : ""
          }))
          .filter(item => item.label && item.value && item.whyItMatters)
      : fallbackReport.keyMetrics;
  const keyMetrics = ensureSetPieceMetric(
    keyMetricsRaw.length ? keyMetricsRaw : fallbackReport.keyMetrics,
    fallbackReport.keyMetrics,
    metrics
  );

  const strengths = normalizeStringList(payload?.strengths, fallbackReport.strengths);
  const weaknesses = normalizeStringList(payload?.weaknesses, fallbackReport.weaknesses);
  const opponentGamePlan = normalizeStringList(
    payload?.opponentGamePlan,
    fallbackReport.opponentGamePlan
  );

  return {
    reportTitle,
    matchesAnalyzed: matchesCount,
    executiveSummary,
    keyMetrics: keyMetrics.length ? keyMetrics : fallbackReport.keyMetrics,
    sections: ensureSections(payload?.sections, fallbackReport.sections),
    strengths,
    weaknesses,
    opponentGamePlan,
    supplementalInsights: buildSupplementSnapshot(supplementalInsights)
  };
};

const buildMetricCards = metrics => {
  const cards = [];

  const addCard = (label, value, whyItMatters) => {
    if (!value) return;
    cards.push({ label, value, whyItMatters });
  };

  addCard(
    "Possession",
    formatPct(metrics.possessionAvg),
    "Indicates baseline control and tempo ownership."
  );
  addCard(
    "Pass Accuracy",
    formatPct(metrics.passAccuracyPct),
    "Signals ball security during progression."
  );
  addCard(
    "PPDA",
    formatNumber(metrics.ppdaAvg),
    "Lower values reflect higher pressing intensity."
  );
  addCard(
    "Recoveries / Match",
    formatNumber(metrics.recoveriesAvg),
    "Shows how often the team regains second phases."
  );
  addCard(
    "Shots / Match",
    formatNumber(metrics.shotsAvg),
    "Tracks chance volume consistency."
  );
  addCard(
    "Shot Accuracy",
    formatPct(metrics.shotAccuracyPct, 0),
    "Links shot selection to final-third efficiency."
  );
  addCard(
    "xG Difference",
    formatSigned(metrics.xgDiff, 2),
    "Balances chance quality created versus conceded."
  );
  addCard(
    "Set-piece impact",
    metrics.cornersAvg != null ? `${formatNumber(metrics.cornersAvg)} corners/match` : null,
    "Dead-ball volume is a stable chance source when open play is limited."
  );
  addCard(
    "Goals For / Against",
    metrics.goalsForAvg != null && metrics.goalsAgainstAvg != null
      ? `${formatNumber(metrics.goalsForAvg, 2)} / ${formatNumber(metrics.goalsAgainstAvg, 2)}`
      : null,
    "Summarizes practical output at both ends."
  );

  return cards.slice(0, 8);
};

const buildStrengths = metrics => {
  const strengths = [];
  if (metrics.possessionAvg != null && metrics.possessionAvg >= 55) {
    strengths.push("Sustained possession profile allows controlled buildup phases.");
  }
  if (metrics.passAccuracyPct != null && metrics.passAccuracyPct >= 84) {
    strengths.push("High pass accuracy supports stable circulation under pressure.");
  }
  if (metrics.ppdaAvg != null && metrics.ppdaAvg <= 9.5) {
    strengths.push("Aggressive pressing profile disrupts opponent exits early.");
  }
  if (metrics.xgDiff != null && metrics.xgDiff >= 0.2) {
    strengths.push("Positive xG balance indicates better chance quality than opponents.");
  }
  if (metrics.shotAccuracyPct != null && metrics.shotAccuracyPct >= 35) {
    strengths.push("Shot selection quality is above average in this sample.");
  }
  if (metrics.recoveriesAvg != null && metrics.recoveriesAvg >= 12) {
    strengths.push("Ball recovery volume supports repeat attacks after turnovers.");
  }
  return strengths.slice(0, 5);
};

const buildWeaknesses = metrics => {
  const weaknesses = [];
  if (metrics.possessionAvg != null && metrics.possessionAvg <= 45) {
    weaknesses.push("Possession control is limited and can force long defensive spells.");
  }
  if (metrics.passAccuracyPct != null && metrics.passAccuracyPct <= 79) {
    weaknesses.push("Pass security drops too often in progression phases.");
  }
  if (metrics.ppdaAvg != null && metrics.ppdaAvg >= 13) {
    weaknesses.push("Pressing engagement is delayed, allowing cleaner opponent buildup.");
  }
  if (metrics.xgDiff != null && metrics.xgDiff <= -0.15) {
    weaknesses.push("Chance-quality balance is negative across the sample.");
  }
  if (metrics.shotAccuracyPct != null && metrics.shotAccuracyPct <= 30) {
    weaknesses.push("Final-third execution lacks enough shots on target.");
  }
  if (metrics.goalsAgainstAvg != null && metrics.goalsAgainstAvg >= 1.6) {
    weaknesses.push("Goals conceded rate suggests defensive instability over 90 minutes.");
  }
  return weaknesses.slice(0, 5);
};

const buildOpponentPlan = metrics => {
  const plan = [];
  if (metrics.ppdaAvg != null && metrics.ppdaAvg <= 9.5) {
    plan.push("Use third-man exits and quick wall passes to beat first-wave pressure.");
  } else {
    plan.push("Increase tempo in buildup to exploit delayed pressing triggers.");
  }
  if (metrics.passAccuracyPct != null && metrics.passAccuracyPct >= 84) {
    plan.push("Deny central passing lanes and force progression to the flanks.");
  } else {
    plan.push("Press ball-side midfield aggressively to force rushed distribution.");
  }
  if (metrics.shotAccuracyPct != null && metrics.shotAccuracyPct >= 35) {
    plan.push("Protect cut-back zones and block central shooting lanes early.");
  } else {
    plan.push("Allow low-value shots from distance, prioritize box control.");
  }
  if (metrics.longPassShareAvg != null && metrics.longPassShareAvg >= 34) {
    plan.push("Prepare second-ball structure against long switches and direct play.");
  }
  return plan.slice(0, 5);
};

const sectionFindings = (title, metrics, matchesCount) => {
  switch (title) {
    case "In Possession":
      return normalizeStringList([
        metrics.possessionAvg != null
          ? `Average possession is ${formatPct(metrics.possessionAvg)} across ${matchesCount} matches.`
          : null,
        metrics.passAccuracyPct != null
          ? `Pass accuracy sits at ${formatPct(metrics.passAccuracyPct)}, shaping buildup reliability.`
          : null,
        metrics.longPassShareAvg != null
          ? `Long pass share is ${formatPct(metrics.longPassShareAvg)}, indicating vertical-direct intent.`
          : null
      ]);
    case "Out of Possession":
      return normalizeStringList([
        metrics.ppdaAvg != null
          ? `PPDA at ${formatNumber(metrics.ppdaAvg)} defines the pressing engagement level.`
          : null,
        metrics.recoveriesAvg != null
          ? `Recoveries average ${formatNumber(metrics.recoveriesAvg)} per match.`
          : null,
        metrics.goalsAgainstAvg != null
          ? `Conceding ${formatNumber(metrics.goalsAgainstAvg, 2)} goals per match over the sample.`
          : null
      ]);
    case "Transitions":
      return normalizeStringList([
        metrics.attacksAvg != null
          ? `Attacks average ${formatNumber(metrics.attacksAvg)} per match.`
          : null,
        metrics.opponentRecoveriesAvg != null
          ? `Opponent-half recoveries at ${formatNumber(metrics.opponentRecoveriesAvg)} show counter-press outcomes.`
          : null,
        metrics.deadTimeAvg != null
          ? `Average dead time of ${formatNumber(metrics.deadTimeAvg / 60, 1)} minutes hints at transition tempo.`
          : null
      ]);
    case "Chance Creation and Finishing":
      return normalizeStringList([
        metrics.shotsAvg != null
          ? `Shot volume is ${formatNumber(metrics.shotsAvg)} per game.`
          : null,
        metrics.shotAccuracyPct != null
          ? `Shot accuracy is ${formatPct(metrics.shotAccuracyPct, 0)}.`
          : null,
        metrics.xgDiff != null
          ? `xG difference of ${formatSigned(metrics.xgDiff, 2)} reflects chance-quality balance.`
          : null
      ]);
    case "Set Pieces and Duels":
      return normalizeStringList([
        metrics.cornersAvg != null
          ? `Corners average ${formatNumber(metrics.cornersAvg)} per match.`
          : null,
        metrics.duelsAvg != null
          ? `Total duels are ${formatNumber(metrics.duelsAvg)} per match.`
          : null,
        metrics.duelsWonPct != null
          ? `Duel win rate is ${formatPct(metrics.duelsWonPct)}.`
          : null
      ]);
    case "Squad and Game-State Notes":
      return normalizeStringList([
        metrics.goalsForAvg != null && metrics.goalsAgainstAvg != null
          ? `Goals profile is ${formatNumber(metrics.goalsForAvg, 2)} scored vs ${formatNumber(metrics.goalsAgainstAvg, 2)} conceded per match.`
          : null,
        metrics.possessionTrend != null
          ? `Possession trend over the sample is ${formatSigned(metrics.possessionTrend, 1)} points from oldest to newest match.`
          : null,
        "Use this report with video review to confirm repeatable tactical behaviors."
      ]);
    default:
      return ["Insufficient data to expand this section yet."];
  }
};

const buildFallbackReport = ({
  teamName,
  matchesCount,
  dateRange,
  record,
  metrics,
  supplementalInsights = []
}) => {
  const supplementalSnapshot = buildSupplementSnapshot(supplementalInsights);
  const strengths = buildStrengths(metrics);
  const weaknesses = buildWeaknesses(metrics);

  const executiveParts = [
    `${teamName || "This team"} is evaluated over ${matchesCount} matches (${record}).`,
    dateRange ? `Sample window: ${dateRange}.` : null,
    supplementalSnapshot.length
      ? `Includes ${supplementalSnapshot.length} supplemental dossier source(s).`
      : null,
    metrics.xgDiff != null
      ? `xG difference is ${formatSigned(metrics.xgDiff, 2)} per match.`
      : "Chance quality data is limited in this sample."
  ].filter(Boolean);

  return {
    reportTitle: `${teamName || "Team"} - Tactical Report`,
    matchesAnalyzed: matchesCount,
    executiveSummary: executiveParts.join(" "),
    keyMetrics: buildMetricCards(metrics),
    sections: SECTION_TITLES.map(title => ({
      title,
      findings: sectionFindings(title, metrics, matchesCount)
    })),
    strengths: strengths.length ? strengths : ["Current sample does not show a clear standout edge."],
    weaknesses: weaknesses.length ? weaknesses : ["Current sample does not show a single dominant weakness."],
    opponentGamePlan: buildOpponentPlan(metrics),
    supplementalInsights: supplementalSnapshot
  };
};

const summarizeMatches = contexts => {
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

  const matchRows = [];
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;

  contexts.forEach(context => {
    const { match, side, teamStats, opponentStats, dateValue } = context;
    const opponentName = side === "home" ? getTeamLabel(match?.awayTeam) : getTeamLabel(match?.homeTeam);

    pushValue(accum.possession, teamStats?.possessionPct);
    pushValue(accum.passes, teamStats?.passes);
    pushValue(accum.passesAccurate, teamStats?.passesAccurate);
    pushValue(accum.longPassShare, teamStats?.longPassSharePct);
    pushValue(accum.ppda, teamStats?.ppda);
    pushValue(accum.recoveries, teamStats?.recoveries);
    pushValue(accum.opponentRecoveries, teamStats?.opponentHalfRecoveries);
    pushValue(accum.purePossession, teamStats?.purePossessionSec);
    pushValue(accum.avgPossessionDuration, teamStats?.avgPossessionDurationSec);
    pushValue(accum.deadTime, teamStats?.deadTimeSec);
    pushValue(accum.shots, teamStats?.shots);
    pushValue(accum.shotsOnTarget, teamStats?.shotsOnTarget);
    pushValue(accum.corners, teamStats?.corners);
    pushValue(accum.xG, teamStats?.xG);
    pushValue(accum.duels, teamStats?.duels);
    pushValue(accum.duelsWon, teamStats?.duelsWon);
    pushValue(accum.attacks, teamStats?.attacks);

    if (opponentStats?.xG != null) {
      pushValue(accum.xGAgainst, opponentStats.xG);
    } else if (teamStats?.xGAgainst != null) {
      pushValue(accum.xGAgainst, teamStats.xGAgainst);
    }

    const score = parseScore(match);
    const goalsFor = score ? (side === "home" ? score.home : score.away) : null;
    const goalsAgainst = score ? (side === "home" ? score.away : score.home) : null;
    let result = "N/A";

    if (goalsFor != null && goalsAgainst != null) {
      totalGoalsFor += goalsFor;
      totalGoalsAgainst += goalsAgainst;
      if (goalsFor > goalsAgainst) {
        wins += 1;
        result = "W";
      } else if (goalsFor === goalsAgainst) {
        draws += 1;
        result = "D";
      } else {
        losses += 1;
        result = "L";
      }
    }

    const passAccuracyPct =
      teamStats?.passes != null && teamStats?.passesAccurate != null && Number(teamStats.passes) !== 0
        ? (Number(teamStats.passesAccurate) / Number(teamStats.passes)) * 100
        : null;

    matchRows.push({
      date: dateValue ? dateValue.toISOString().slice(0, 10) : null,
      opponent: opponentName,
      venue: side,
      score:
        goalsFor != null && goalsAgainst != null
          ? `${goalsFor}-${goalsAgainst}`
          : typeof match?.score === "string"
            ? match.score
            : null,
      result,
      possessionPct: toNumber(teamStats?.possessionPct),
      passAccuracyPct,
      ppda: toNumber(teamStats?.ppda),
      recoveries: toNumber(teamStats?.recoveries),
      shots: toNumber(teamStats?.shots),
      shotsOnTarget: toNumber(teamStats?.shotsOnTarget),
      xG: toNumber(teamStats?.xG),
      xGAgainst: opponentStats?.xG != null ? toNumber(opponentStats.xG) : toNumber(teamStats?.xGAgainst)
    });
  });

  const matchesCount = contexts.length;
  const possessionAvg = average(accum.possession);
  const passesSum = accum.passes.sum;
  const passAccuracyPct = passesSum ? (accum.passesAccurate.sum / passesSum) * 100 : null;
  const longPassShareAvg = average(accum.longPassShare);
  const ppdaAvg = average(accum.ppda);
  const recoveriesAvg = average(accum.recoveries);
  const opponentRecoveriesAvg = average(accum.opponentRecoveries);
  const purePossessionAvg = average(accum.purePossession);
  const avgPossessionDurationAvg = average(accum.avgPossessionDuration);
  const deadTimeAvg = average(accum.deadTime);
  const shotsAvg = average(accum.shots);
  const shotsOnTargetAvg = average(accum.shotsOnTarget);
  const shotAccuracyPct =
    shotsAvg != null && shotsAvg !== 0 && shotsOnTargetAvg != null
      ? (shotsOnTargetAvg / shotsAvg) * 100
      : null;
  const cornersAvg = average(accum.corners);
  const xGAvg = average(accum.xG);
  const xGAgainstAvg = average(accum.xGAgainst);
  const xgDiff = xGAvg != null && xGAgainstAvg != null ? xGAvg - xGAgainstAvg : null;
  const duelsAvg = average(accum.duels);
  const duelsWonAvg = average(accum.duelsWon);
  const duelsWonPct =
    duelsAvg != null && duelsAvg !== 0 && duelsWonAvg != null ? (duelsWonAvg / duelsAvg) * 100 : null;
  const attacksAvg = average(accum.attacks);
  const goalsForAvg = matchesCount ? totalGoalsFor / matchesCount : null;
  const goalsAgainstAvg = matchesCount ? totalGoalsAgainst / matchesCount : null;

  const oldest = contexts[contexts.length - 1];
  const newest = contexts[0];
  const oldestPossession = oldest ? toNumber(oldest.teamStats?.possessionPct) : null;
  const newestPossession = newest ? toNumber(newest.teamStats?.possessionPct) : null;
  const possessionTrend =
    oldestPossession != null && newestPossession != null ? newestPossession - oldestPossession : null;

  const dateRange = (() => {
    const start = oldest?.dateValue;
    const end = newest?.dateValue;
    if (start && end) return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
    if (start) return formatDateLabel(start);
    if (end) return formatDateLabel(end);
    return "";
  })();

  return {
    matchesCount,
    dateRange,
    record: `${wins}W-${draws}D-${losses}L`,
    metrics: {
      possessionAvg,
      possessionTrend,
      passesSum,
      passAccuracyPct,
      longPassShareAvg,
      ppdaAvg,
      recoveriesAvg,
      opponentRecoveriesAvg,
      purePossessionAvg,
      avgPossessionDurationAvg,
      deadTimeAvg,
      shotsAvg,
      shotsOnTargetAvg,
      shotAccuracyPct,
      cornersAvg,
      xGAvg,
      xGAgainstAvg,
      xgDiff,
      duelsAvg,
      duelsWonAvg,
      duelsWonPct,
      attacksAvg,
      goalsForAvg,
      goalsAgainstAvg
    },
    matchRows
  };
};

export async function generateTeamReport({
  matches = [],
  teamId,
  teamName,
  maxMatches = 10,
  supplementalInsights = []
} = {}) {
  if (!Array.isArray(matches) || !matches.length) {
    return {
      reportTitle: `${teamName || "Team"} - Tactical Report`,
      matchesAnalyzed: 0,
      executiveSummary: "No matches available to generate a detailed team report.",
      keyMetrics: [],
      sections: SECTION_TITLES.map(title => ({
        title,
        findings: ["No match data available for this section."]
      })),
      strengths: ["Not enough data available."],
      weaknesses: ["Not enough data available."],
      opponentGamePlan: ["Load match data before building an opponent plan."],
      supplementalInsights: buildSupplementSnapshot(supplementalInsights)
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
    contexts.push({
      ...context,
      match,
      dateValue: parseDateValue(match?.date)
    });
  }

  if (!contexts.length) {
    return {
      reportTitle: `${teamName || "Team"} - Tactical Report`,
      matchesAnalyzed: 0,
      executiveSummary: "No team-tagged matches found in the selected sample.",
      keyMetrics: [],
      sections: SECTION_TITLES.map(title => ({
        title,
        findings: ["No team-tagged match data available for this section."]
      })),
      strengths: ["Not enough data available."],
      weaknesses: ["Not enough data available."],
      opponentGamePlan: ["Assign this team to match records, then regenerate."],
      supplementalInsights: buildSupplementSnapshot(supplementalInsights)
    };
  }

  const { matchesCount, dateRange, record, metrics, matchRows } = summarizeMatches(contexts);
  const fallbackReport = buildFallbackReport({
    teamName,
    matchesCount,
    dateRange,
    record,
    metrics,
    supplementalInsights
  });

  const client = getOpenAI();
  if (!client) return fallbackReport;

  const prompt = buildAiPrompt({
    teamName,
    matchesCount,
    dateRange,
    record,
    metrics,
    matchRows,
    supplementalInsights
  });

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content:
            "You are a senior football performance analyst. Write concise, actionable, data-grounded team reports."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    });

    const message = response?.choices?.[0]?.message?.content?.trim();
    const parsed = parseAiJson(message);
    if (!parsed) return fallbackReport;
    return normalizeReport(parsed, fallbackReport, matchesCount, supplementalInsights, metrics);
  } catch (error) {
    console.warn("AI team report failed, falling back:", error.message || error);
    return fallbackReport;
  }
}

export default generateTeamReport;
