// src/matches/pickBestPerformers.js

import { BEST_PERFORMER_STATS } from "./bestStats.js";

const MIN_MINUTES = 45;

/* ------------------------------
 * Impact scoring (match-only)
 * - role-aware weighting
 * - negatives for conceded/losses
 * ------------------------------ */

function v(player, key) {
  return Number(player.matchStats?.[key]) || 0;
}

export function computeImpactScore(player) {
  const role = player.rolePlayed || "GENERIC";

  switch (role) {
    case "GK":
      return (
        v(player, "saves") * 3 +
        v(player, "reflexSaves") * 2 +
        v(player, "xCG") * 4 +
        v(player, "exits") * 1.5 -
        v(player, "goalsConceded") * 4
      );

    case "CB":
      return (
        v(player, "clearances") * 1.6 +
        v(player, "interceptions") * 2.1 +
        v(player, "duelsWon") * 1.3 +
        v(player, "aerialDuelsWon") * 1.8 +
        v(player, "recoveriesOppHalf") * 0.8 -
        v(player, "lossesOwnHalf") * 2.2
      );

    case "FULLBACK":
      return (
        v(player, "interceptions") * 1.6 +
        v(player, "duelsWon") * 1.1 +
        v(player, "aerialDuelsWon") * 1.2 +
        v(player, "recoveriesOppHalf") * 1.0 +
        v(player, "crossesAccurate") * 0.8 +
        v(player, "shotAssists") * 1.0 -
        v(player, "lossesOwnHalf") * 1.8
      );

    case "WINGBACK":
      return (
        v(player, "interceptions") * 1.4 +
        v(player, "duelsWon") * 1.1 +
        v(player, "aerialDuelsWon") * 1.4 +
        v(player, "recoveriesOppHalf") * 1.1 +
        v(player, "crossesAccurate") * 1.0 +
        v(player, "progressiveRuns") * 1.0 +
        v(player, "shotAssists") * 1.0 -
        v(player, "lossesOwnHalf") * 1.9
      );

    case "MIDFIELDER":
      return (
        v(player, "assists") * 2.5 +
        v(player, "xA") * 1.5 +
        v(player, "shotAssists") * 1.5 +
        v(player, "passesFinalThirdAccurate") * 1.2 +
        v(player, "recoveriesOppHalf") * 1.0 +
        v(player, "interceptions") * 1.0 +
        v(player, "duelsWon") * 0.8 -
        v(player, "lossesOwnHalf") * 1.5
      );

    case "WINGER":
      return (
        v(player, "goals") * 3.0 +
        v(player, "xG") * 1.8 +
        v(player, "assists") * 2.4 +
        v(player, "xA") * 1.8 +
        v(player, "shotsOnTarget") * 1.6 +
        v(player, "dribblesSuccessful") * 1.6 +
        v(player, "shotAssists") * 1.2 -
        v(player, "lossesOwnHalf") * 1.0
      );

    case "ATTACKER":
      return (
        v(player, "goals") * 4 +
        v(player, "xG") * 2 +
        v(player, "assists") * 3 +
        v(player, "xA") * 2 +
        v(player, "shotsOnTarget") * 1.5 +
        v(player, "dribblesSuccessful") * 1.5 +
        v(player, "shotAssists") * 1.0 -
        v(player, "lossesOwnHalf") * 0.5
      );

    default:
      return (
        v(player, "goals") * 3 +
        v(player, "assists") * 2 +
        v(player, "passes") * 0.5 +
        v(player, "duelsWon") * 1 -
        v(player, "lossesOwnHalf") * 1
      );
  }
}

/* ------------------------------
 * Key stats extraction
 * ------------------------------ */

function extractKeyStats(player) {
  const role = player.rolePlayed || "GENERIC";
  const fields = BEST_PERFORMER_STATS[role] || BEST_PERFORMER_STATS.GENERIC;

  const stats = {};
  for (const f of fields) {
    if (player.matchStats?.[f] != null && player.matchStats[f] !== 0) {
      stats[f] = player.matchStats[f];
    }
  }
  return stats;
}

/* ------------------------------
 * Team best picker
 * ------------------------------ */

function pickTeamBest(players) {
  const eligible = players.filter(
    p =>
      p.minutesPlayed >= MIN_MINUTES &&
      p.gameGrade?.overall10 != null
  );

  if (!eligible.length) return null;

  const scored = eligible.map(p => {
    const _impactScore = computeImpactScore(p);
    const grade10 = Number(p.gameGrade?.overall10) || 0;
    const combinedScore = grade10 * 10 + _impactScore;
    return { ...p, _impactScore, _combinedScore: combinedScore };
  });

  scored.sort((a, b) => {
    if (b.gameGrade.overall10 !== a.gameGrade.overall10) {
      return b.gameGrade.overall10 - a.gameGrade.overall10;
    }
    if (b._combinedScore !== a._combinedScore) {
      return b._combinedScore - a._combinedScore;
    }
    if (b._impactScore !== a._impactScore) {
      return b._impactScore - a._impactScore;
    }
    if (b.minutesPlayed !== a.minutesPlayed) {
      return b.minutesPlayed - a.minutesPlayed;
    }
    return (b.delta ?? 0) - (a.delta ?? 0);
  });

  const best = scored[0];

  return {
    playerId: best.playerId,
    name: best.canonicalName || best.name,
    role: best.rolePlayed,
    minutesPlayed: best.minutesPlayed,
    gameGrade: best.gameGrade.overall10,
    delta: best.delta,
    impactScore: best._impactScore,
    keyStats: extractKeyStats(best)
  };
}

/* ------------------------------
 * Export (FIXED)
 * ------------------------------ */

export function pickBestPerformers(players) {
  return {
    home: pickTeamBest(players.filter(p => p.team === "home")),
    away: pickTeamBest(players.filter(p => p.team === "away"))
  };
}
