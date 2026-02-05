// src/matches/processMatch.js
import { pickBestPerformers, computeImpactScore } from "../grading/pickBestPerformer.js";
import { gradeGame } from "../grading/gameGrade.js";
import { gradeGameGK } from "../grading/gradeGK.js";
import { computeDerivedMetrics } from "../grading/derivedMetrics.js";
import { detectPrimaryRole } from "../grading/roleDetector.js";

function normalizeName(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function processMatch({
  players,
  minutesByPlayer,
  statsByPlayer,
  seasonGradesMap,
  homeTeamId,
  awayTeamId,
  ...meta
}) {
  const MIN_MINUTES_FOR_GRADE_OUTFIELD = 30;
  const MIN_MINUTES_FOR_GRADE_GK = 45;
  const interim = [];
  const statsPool = new Map();
  if (statsByPlayer && typeof statsByPlayer === "object") {
    for (const [k, v] of Object.entries(statsByPlayer)) {
      const keyStr = String(k);
      const parts = keyStr.split("|");
      const base = parts[0];
      const statPayload = v?.stats ? v.stats : v;

      const addToPool = poolKey => {
        if (!poolKey) return;
        if (!statsPool.has(poolKey)) statsPool.set(poolKey, []);
        const arr = statsPool.get(poolKey);
        if (keyStr.includes("|")) {
          arr.unshift(statPayload);
        } else {
          arr.push(statPayload);
        }
        statsPool.set(poolKey, arr);
      };

      addToPool(base);
      const numberPart = parts.find(p => p.startsWith("#"));
      if (numberPart) {
        addToPool(`${base}${numberPart}`);
      }
    }
  }

  for (const p of players) {
    const key = normalizeName(p.name);
    const minutesInfo = minutesByPlayer[key] || {
      totalMinutes: 0,
      roleMinutes: {}
    };
    const keyWithNumber = p.number != null ? `${p.name}|${p.number}` : null;
    const keyWithMinutes =
      minutesInfo.totalMinutes != null ? `${p.name}|m${minutesInfo.totalMinutes}` : null;

    const numKeyVariants = [];
    if (p.number != null) {
      numKeyVariants.push(`${p.name}|#${p.number}`);
      numKeyVariants.push(`${p.name}#${p.number}`);
    }

    const matchStatsRaw =
      numKeyVariants.map(k => statsByPlayer[k]?.stats).find(Boolean) ||
      (keyWithNumber && statsByPlayer[keyWithNumber]?.stats) ||
      (keyWithMinutes && statsByPlayer[keyWithMinutes]?.stats) ||
      statsByPlayer[p.name]?.stats ||
      statsByPlayer[key]?.stats ||
      {};

    const pool =
      numKeyVariants.map(k => statsPool.get(k)).find(Boolean) ||
      statsPool.get(p.name) ||
      statsPool.get(key) ||
      null;

    // Prefer the richest pooled entry (most keys) when multiple stats blobs exist (e.g., same name different rows)
    let matchStats = matchStatsRaw;
    if (pool && pool.length) {
      let best = null;
      let bestScore = -Infinity;
      for (const item of pool) {
        if (!item) continue;
        let score = Object.keys(item).length;
        const goals = item.goals?.attempts ?? 0;
        const shots = item.shots?.attempts ?? 0;
        const passes = item.passes?.attempts ?? 0;
        const crosses = item.crosses?.attempts ?? 0;
        const duels = item.duels?.attempts ?? 0;
        const losses = (item.losses?.attempts ?? item.lossesOwnHalf?.attempts) ?? 0;
        const rec = item.recoveries?.attempts ?? 0;

        if (passes > 0) score += 5;
        if (duels > 0) score += 5;
        if (losses > 0) score += 4;
        if (rec > 0) score += 4;

        if (goals > 3) score -= 15;
        if (shots > 15) score -= 10;
        if (passes > 120) score -= 10;
        if (crosses > 15) score -= 5;

        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }
      matchStats = best || matchStatsRaw;
    }
    if (!matchStats) matchStats = {};
    if (!matchStats) matchStats = {};

    const statsForDerived = {};
    const matchStatsFlat = {};
    for (const [key, val] of Object.entries(matchStats)) {
      const attempts = Number(val?.attempts || 0);
      const success = Number(val?.success || 0);

      if (key === "shotsOnTarget") {
        // We keep on-target in the success field of shots; avoid storing a separate field.
        if (val?.attempts != null && statsForDerived.shotsOnTarget == null) {
          statsForDerived.shotsOnTarget = attempts;
        }
        continue;
      }

      matchStatsFlat[key] = attempts;
        if (val?.success != null) {
          const successFields = new Set([
            "passes",
            "crosses",
            "dribbles",
            "duels",
            "groundDuels",
            "aerialDuels",
            "losses",
            "defensiveDuels",
            "offensiveDuels",
            "forwardPasses",
            "progressivePasses",
            "passesFinalThird",
            "throughPasses"
          ]);
          if (successFields.has(key)) {
            matchStatsFlat[`${key}Success`] = success;
          }
        }

      switch (key) {
        case "passes":
          statsForDerived.passes = attempts;
          statsForDerived.accuratePasses = success;
          break;
        case "losses":
          statsForDerived.losses = attempts;
          if (val?.success != null) {
            statsForDerived.lossesOwnHalf = success;
          }
          break;
        case "crosses":
          statsForDerived.crosses = attempts;
          statsForDerived.crossesAccurate = success;
          break;
        case "duels":
          statsForDerived.duels = attempts;
          statsForDerived.duelsWon = success;
          break;
        case "defensiveDuels":
          statsForDerived.defensiveDuels = attempts;
          statsForDerived.defensiveDuelsWon = success;
          break;
        case "offensiveDuels":
          statsForDerived.offensiveDuels = attempts;
          statsForDerived.offensiveDuelsWon = success;
          break;
        case "groundDuels":
          statsForDerived.defensiveDuels = attempts;
          statsForDerived.defensiveDuelsWon = success;
          break;
        case "dribbles":
          statsForDerived.offensiveDuels = attempts;
          statsForDerived.offensiveDuelsWon = success;
          break;
        case "aerialDuels":
          statsForDerived.aerialDuels = attempts;
          statsForDerived.aerialDuelsWon = success;
          break;
        case "forwardPasses":
          statsForDerived.forwardPasses = attempts;
          statsForDerived.forwardPassesAccurate = success;
          break;
        case "progressivePasses":
          statsForDerived.progressivePasses = attempts;
          statsForDerived.progressivePassesAccurate = success;
          break;
        case "passesFinalThird":
          statsForDerived.passesFinalThird = attempts;
          statsForDerived.passesFinalThirdAccurate = success;
          break;
        case "throughPasses":
          statsForDerived.throughPasses = attempts;
          statsForDerived.throughPassesAccurate = success;
          break;
        case "keyPasses":
          statsForDerived.shotAssists = attempts;
          break;
        case "goals":
          statsForDerived.goals = attempts;
          break;
        case "assists":
          statsForDerived.assists = attempts;
          break;
        case "xG":
          statsForDerived.xG = attempts;
          break;
        case "xA":
          statsForDerived.xA = attempts;
          break;
        case "recoveries":
          statsForDerived.recoveries = attempts;
          statsForDerived.recoveriesOppHalf = attempts;
          break;
        case "shots":
          statsForDerived.shots = attempts;
          if (val?.success != null) {
            statsForDerived.shotsOnTarget = success;
          }
          break;
        case "interceptions":
          statsForDerived.interceptions = attempts;
          break;
        case "clearances":
          statsForDerived.clearances = attempts;
          break;
        case "fouls":
          statsForDerived.fouls = attempts;
          break;
        default:
          statsForDerived[key] = attempts;
      }
    }

    /* ---------------- ROLE PLAYED ---------------- */
    const POSITION_MAP = {
      GK: "GK",
      CB: "CB",
      RCB: "CB",
      LCB: "CB",
      LB: "FULLBACK",
      RB: "FULLBACK",
      WB: "WINGBACK",
      RWB: "WINGBACK",
      LWB: "WINGBACK",
      DM: "MIDFIELDER",
      RDMF: "MIDFIELDER",
      LDMF: "MIDFIELDER",
      CM: "MIDFIELDER",
      AMF: "MIDFIELDER",
      RCMF: "MIDFIELDER",
      LCMF: "MIDFIELDER",
      AM: "MIDFIELDER",
      RAMF: "MIDFIELDER",
      LAMF: "MIDFIELDER",
      RW: "WINGER",
      LW: "WINGER",
      RWF: "WINGER",
      LWF: "WINGER",
      W: "WINGER",
      FW: "ATTACKER",
      ST: "ATTACKER",
      CF: "ATTACKER"
    };

    const rolePlayed =
      POSITION_MAP[p.position] ?? "GENERIC";

    /* ---------------- DERIVED METRICS ---------------- */
    const derived = computeDerivedMetrics({
      ...statsForDerived,
      primaryRole: rolePlayed,
      position: rolePlayed,
      positions: [rolePlayed],
      minutes: minutesInfo.totalMinutes || 0
    });

    /* ---------------- SEASON COMPARISON ---------------- */
    const seasonGrade = seasonGradesMap[p.playerId]?.overall10 ?? null;

    interim.push({
      ...p,
      minutesPlayed: minutesInfo.totalMinutes || 0,
      roleMinutes: minutesInfo.roleMinutes || {},
      rolePlayed,
      seasonGrade,
      derived,

      matchStats: matchStatsFlat,
      impactScore: computeImpactScore({
        rolePlayed,
        matchStats: matchStatsFlat
      }),
      seasonGradeSnapshot: seasonGrade
        ? { overall10: seasonGrade }
        : null
    });
  }

  const processedPlayers = interim.map(pl => {
    const rolePlayed = pl.rolePlayed;
    const isGK = rolePlayed === "GK";
    const enoughMinutes = (pl.minutesPlayed || 0) >= (isGK
      ? MIN_MINUTES_FOR_GRADE_GK
      : MIN_MINUTES_FOR_GRADE_OUTFIELD);

    let gameGrade = null;
    const hasStats = pl.matchStats && Object.keys(pl.matchStats).length > 0;
    if (enoughMinutes && hasStats) {
      gameGrade = isGK
        ? gradeGameGK({ derived: pl.derived })
        : gradeGame({
            role: rolePlayed,
            rawStats: pl.matchStats,
            minutes: pl.minutesPlayed || 0
          });
    }

    const seasonGrade = pl.seasonGrade ?? null;
    const delta = seasonGrade && gameGrade?.overall10 != null
      ? Math.round((gameGrade.overall10 - seasonGrade) * 10) / 10
      : null;

    return {
      ...pl,
      gameGrade,
      grade: gameGrade?.overall10 ?? null,
      delta
    };
  });

  const bestPerformers = pickBestPerformers(
    processedPlayers,
    homeTeamId,
    awayTeamId
  );

  return {
    ...meta,
    homeTeamId,
    awayTeamId,
    players: processedPlayers,
    bestPerformers,
    bestPerformer: bestPerformers
  };
}
