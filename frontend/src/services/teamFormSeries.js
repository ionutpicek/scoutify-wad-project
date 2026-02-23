import { collection, limit, orderBy, query } from "firebase/firestore";
import { db, getDocsLogged as getDocs } from "../firebase.jsx";

const DEFAULT_MAX_POINTS = 8;
const DEFAULT_FETCH_LIMIT = 40;
const RESULT_BONUS = {
  win: 0.45,
  draw: 0.05,
  loss: -0.4,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    const millis = (Number(value.seconds) * 1000) + Math.round(Number(value.nanoseconds || 0) / 1e6);
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatShortDate = (dateObj) => {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(dateObj);
  } catch {
    return dateObj.toLocaleDateString();
  }
};

const readPlayerMatchGrade = (player) => {
  const direct = Number(player?.grade);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const nested = Number(player?.gameGrade?.overall10);
  if (Number.isFinite(nested) && nested > 0) return nested;
  return null;
};

const parseScorePair = (scoreValue) => {
  const raw = String(scoreValue || "").trim();
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;
  const homeGoals = Number(match[1]);
  const awayGoals = Number(match[2]);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;
  return { homeGoals, awayGoals };
};

const computeResultAdjustment = (match, side) => {
  const parsed = parseScorePair(match?.score);
  if (!parsed || (side !== "home" && side !== "away")) {
    return {
      outcome: null,
      resultLabel: null,
      bonus: 0,
      goalDiff: 0,
    };
  }

  const teamGoals = side === "home" ? parsed.homeGoals : parsed.awayGoals;
  const opponentGoals = side === "home" ? parsed.awayGoals : parsed.homeGoals;
  const goalDiff = teamGoals - opponentGoals;
  const outcome = goalDiff > 0 ? "win" : goalDiff < 0 ? "loss" : "draw";
  const marginAdj = clamp(goalDiff * 0.08, -0.2, 0.2);
  const bonus = round1((RESULT_BONUS[outcome] || 0) + marginAdj);

  return {
    outcome,
    resultLabel: `${teamGoals}-${opponentGoals}`,
    bonus,
    goalDiff,
  };
};

const resolveTeamSide = (match, teamID, teamName) => {
  const targetId = teamID == null ? null : String(teamID);
  if (targetId && match?.homeTeamId != null && String(match.homeTeamId) === targetId) return "home";
  if (targetId && match?.awayTeamId != null && String(match.awayTeamId) === targetId) return "away";

  const targetName = normalizeName(teamName);
  if (!targetName) return null;
  if (normalizeName(match?.homeTeam) === targetName) return "home";
  if (normalizeName(match?.awayTeam) === targetName) return "away";
  return null;
};

const buildTeamLogoResolver = (teamsList = []) => {
  const byId = new Map();
  const byName = new Map();

  for (const team of Array.isArray(teamsList) ? teamsList : []) {
    const logoURL = team?.photoURL || team?.logoURL || team?.logo || null;
    if (!logoURL) continue;

    const ids = [team?.teamID, team?.id]
      .filter(value => value != null)
      .map(value => String(value));
    ids.forEach(id => byId.set(id, logoURL));

    const names = [team?.name, team?.teamName]
      .map(normalizeName)
      .filter(Boolean);
    names.forEach(name => byName.set(name, logoURL));
  }

  return ({ teamID, teamName }) => {
    if (teamID != null) {
      const byTeamId = byId.get(String(teamID));
      if (byTeamId) return byTeamId;
    }
    const normalizedName = normalizeName(teamName);
    if (normalizedName) {
      const byTeamName = byName.get(normalizedName);
      if (byTeamName) return byTeamName;
    }
    return null;
  };
};

const buildSeriesPoint = (matchDoc, teamID, teamName, resolveTeamLogo) => {
  const match = matchDoc?.data || {};
  const side = resolveTeamSide(match, teamID, teamName);
  if (!side) return null;

  const players = Array.isArray(match.players) ? match.players : [];
  const grades = players
    .filter(player => player?.team === side)
    .map(readPlayerMatchGrade)
    .filter(value => Number.isFinite(value));

  if (!grades.length) return null;

  const dateObj = parseDateValue(match.date);
  const timestamp = dateObj?.getTime?.() ?? 0;
  const opponent = side === "home" ? (match.awayTeam || "Unknown") : (match.homeTeam || "Unknown");
  const opponentTeamId = side === "home" ? match?.awayTeamId : match?.homeTeamId;
  const averageGrade = round1(grades.reduce((sum, value) => sum + value, 0) / grades.length);
  const resultAdj = computeResultAdjustment(match, side);
  const formScore = round1(clamp(averageGrade + resultAdj.bonus, 1, 10));
  const opponentLogoURL = typeof resolveTeamLogo === "function"
    ? resolveTeamLogo({ teamID: opponentTeamId, teamName: opponent })
    : null;

  return {
    id: matchDoc.id,
    value: formScore,
    grade: formScore,
    rawGrade: averageGrade,
    resultBonus: resultAdj.bonus,
    resultOutcome: resultAdj.outcome,
    resultScore: resultAdj.resultLabel,
    goalDiff: resultAdj.goalDiff,
    opponent,
    opponentLogoURL,
    side,
    samples: grades.length,
    date: dateObj ? dateObj.toISOString() : null,
    label: formatShortDate(dateObj),
    timestamp,
  };
};

const sortByMostRecent = (points) =>
  [...points].sort((a, b) => {
    const tsDiff = Number(b?.timestamp || 0) - Number(a?.timestamp || 0);
    if (tsDiff !== 0) return tsDiff;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });

async function fetchRecentMatches() {
  const matchesCol = collection(db, "matches");
  try {
    const recentQuery = query(matchesCol, orderBy("date", "desc"), limit(DEFAULT_FETCH_LIMIT));
    const snapshot = await getDocs(recentQuery);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, data: docSnap.data() || {} }));
  } catch (error) {
    console.warn("Failed ordered matches query, falling back to full fetch:", error);
    const snapshot = await getDocs(matchesCol);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, data: docSnap.data() || {} }));
  }
}

export async function fetchTeamFormSeries({
  teamID,
  teamName,
  teamsList = [],
  maxPoints = DEFAULT_MAX_POINTS,
} = {}) {
  if (!teamID && !teamName) return [];

  const matches = await fetchRecentMatches();
  const resolveTeamLogo = buildTeamLogoResolver(teamsList);
  const points = matches
    .map(matchDoc => buildSeriesPoint(matchDoc, teamID, teamName, resolveTeamLogo))
    .filter(Boolean);

  const recent = sortByMostRecent(points).slice(0, Math.max(1, Number(maxPoints) || DEFAULT_MAX_POINTS));
  return recent.reverse();
}

export function summarizeFormSeries(series = []) {
  const values = (Array.isArray(series) ? series : [])
    .map(item => Number(item?.value ?? item?.grade))
    .filter(value => Number.isFinite(value));

  if (!values.length) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;

  return {
    games: values.length,
    average: round1(total / values.length),
    latest: round1(latest),
    best: round1(Math.max(...values)),
    worst: round1(Math.min(...values)),
    deltaFromPrevious: previous == null ? null : round1(latest - previous),
  };
}
