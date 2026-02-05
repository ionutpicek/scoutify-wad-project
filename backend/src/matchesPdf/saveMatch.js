import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

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
  if (!isMysqlConfigured()) {
    throw new Error("MySQL not configured for saving matches.");
  }

  const mysql = getMysqlPool();
  await mysql.execute(
    `INSERT INTO matches (
      id, match_date, round_no, home_team_id, away_team_id, home_team, away_team,
      score, home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json, source_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      match_date = VALUES(match_date),
      round_no = VALUES(round_no),
      home_team_id = VALUES(home_team_id),
      away_team_id = VALUES(away_team_id),
      home_team = VALUES(home_team),
      away_team = VALUES(away_team),
      score = VALUES(score),
      home_goals = VALUES(home_goals),
      away_goals = VALUES(away_goals),
      team_stats = VALUES(team_stats),
      gps_metrics = VALUES(gps_metrics),
      best_performers = VALUES(best_performers),
      players_json = VALUES(players_json),
      source_payload = VALUES(source_payload),
      updated_at = CURRENT_TIMESTAMP`,
    [
      payload.matchId,
      payload.date ?? null,
      payload.round ?? null,
      payload.homeTeamId != null ? String(payload.homeTeamId) : null,
      payload.awayTeamId != null ? String(payload.awayTeamId) : null,
      payload.homeTeam ?? null,
      payload.awayTeam ?? null,
      payload.score ?? null,
      payload.homeGoals != null ? Number(payload.homeGoals) : null,
      payload.awayGoals != null ? Number(payload.awayGoals) : null,
      payload.teamStats ? JSON.stringify(payload.teamStats) : null,
      payload.gpsMetrics ? JSON.stringify(payload.gpsMetrics) : null,
      payload.bestPerformers ? JSON.stringify(payload.bestPerformers) : null,
      payload.players ? JSON.stringify(payload.players) : null,
      JSON.stringify({ id: payload.matchId, ...payload })
    ]
  );
}
