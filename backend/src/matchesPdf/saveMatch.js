import { db } from "../firebase/firebaseAdmin.js";

// Minimal derived metrics we care about for grading/display.
const DERIVED_KEYS = new Set([
  "savePct",
  "xCG_diff_p90",
  "goalsConceded_p90",
  "saves_p90",
  "duelWinPct",
  "passAccuracy",
  "lossesOwnHalf_p90",
  "recoveries_p90",
  "recoveriesOppHalf_p90",
  "shots_p90",
  "shotAccuracy",
  "goals_p90",
  "xG_p90",
  "assists_p90",
  "xA_p90",
  "crossAccuracy",
  "crossesAccurate_p90",
  "crosses_p90",
  "fouls_p90",
  "yellowCards_p90"
]);

function slimDerived(derived) {
  if (!derived) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(derived)) {
    if (!DERIVED_KEYS.has(k)) continue;
    if (v == null) continue;
    out[k] = typeof v === "number" ? Math.round(v * 1000) / 1000 : v;
  }
  return Object.keys(out).length ? out : undefined;
}

function slimPlayer(p) {
  return {
    name: p.name,
    playerId: p.playerId,
    team: p.team,
    minutesPlayed: p.minutesPlayed,
    position: p.position,
    rolePlayed: p.rolePlayed,
    roleMinutes: p.roleMinutes,
    starter: p.starter,
    number: p.number,
    // Keep a flat grade for UI convenience; mirror overall10
    grade: p.gameGrade?.overall10 ?? p.grade ?? null,
    matchStats: p.matchStats,
    gameGrade: p.gameGrade,
    delta: p.delta,
    seasonGradeSnapshot: p.seasonGradeSnapshot,
    derived: slimDerived(p.derived)
  };
}

function slimMatch(match = {}) {
  const { bestPerformer, players, ...rest } = match;
  return {
    ...rest,
    players: Array.isArray(players) ? players.map(slimPlayer) : players,
    teamStats: match.teamStats || null,
    createdAt: new Date()
  };
}

// Persist match data to Firestore with a filtered payload to avoid bloating documents.
export async function saveMatch(match) {
  const payload = slimMatch(match);

  await db
    .collection("matches")
    .doc(payload.matchId)
    .set(payload);
}
