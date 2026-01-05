// src/matches/importMatchFromPdf.js

import { parseMatchPdf } from "./parseMatchPDF.js";
import { processMatch } from "./processMatch.js";
import { saveMatch } from "./saveMatch.js";
import { loadSeasonGrades } from "./loadSeasonGrades.js";
import { resolvePlayers } from "./resolvePlayers.js";
import { buildMatchId } from "./buildMatchID.js";
import { resolveTeams } from "./resolveTeams.js";
import { generateTeamHighlights } from "./generateSummary.js";
import { parseExcelMetrics } from "../gpsMetrics/parseExcel.js";
import { buildExcelHighlights } from "../gpsMetrics/buildHighlights.js";

function normalizeName(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function importMatchFromPdf(pdfBuffer, filename, options = {}) {
  const { metricsBuffer = null, metricsFilename = null } = options;
  const parsed = await parseMatchPdf(pdfBuffer, filename);

  const { homeTeamId, awayTeamId, homeTeamName: resolvedHomeName, awayTeamName: resolvedAwayName } = await resolveTeams(
    parsed.homeTeam,
    parsed.awayTeam
  );

  const homeTeamName = resolvedHomeName || parsed.homeTeam;
  const awayTeamName = resolvedAwayName || parsed.awayTeam;

  // keep parsed object names aligned with resolved firestore names for display
  parsed.homeTeam = homeTeamName;
  parsed.awayTeam = awayTeamName;

  console.log("Importing match from:", filename);
  console.log("Parsed match:", parsed.homeTeam, "vs", parsed.awayTeam);

  // normalize minutes map
  const normalizedMinutesByPlayer = {};
  for (const [rawName, info] of Object.entries(parsed.minutesByPlayer || {})) {
    normalizedMinutesByPlayer[normalizeName(rawName)] = info;
  }

  // normalize positions map (IMPORTANT)
  const normalizedPositionsByPlayer = {};
  for (const [rawName, pos] of Object.entries(parsed.positionsByPlayer || {})) {
    normalizedPositionsByPlayer[normalizeName(rawName)] = pos;
  }

  const parsedWithIdx = parsed.players.map((p, idx) => ({ ...p, _idx: idx }));

  const resolvedPlayers = await resolvePlayers(parsedWithIdx, {
    homeTeamId,
    awayTeamId
  });

  // Compute starter order to infer team for unresolved starters (keep 11 per side)
  const starterOrder = resolvedPlayers
    .filter(p => p.starter)
    .sort((a, b) => (a._idx ?? 0) - (b._idx ?? 0))
    .map((p, i) => ({ key: p._idx, rank: i + 1 }));
  const starterRankByIdx = new Map(starterOrder.map(({ key, rank }) => [key, rank]));

  const inferTeam = p => {
    if (p.team === "home" || p.team === "away") return p.team;
    if (p.teamId === homeTeamId) return "home";
    if (p.teamId === awayTeamId) return "away";

    if (p.starter) {
      const rank = starterRankByIdx.get(p._idx);
      if (rank && rank <= 11) return "home";
      if (rank && rank <= 22) return "away";
    }

    // For subs/bench, inherit the team from the nearest previous starter in the original order
    if (p._idx != null) {
      const priorStarters = starterOrder
        .filter(s => s.key < p._idx)
        .sort((a, b) => b.key - a.key);
      if (priorStarters.length) {
        const nearestIdx = priorStarters[0].key;
        const nearestPlayer = resolvedPlayers.find(r => r._idx === nearestIdx);
        const t = nearestPlayer
          ? nearestPlayer.team || (nearestPlayer.teamId === homeTeamId ? "home" : nearestPlayer.teamId === awayTeamId ? "away" : null)
          : null;
        if (t) return t;
      }
    }

    return null;
  };

  const resolvedWithTeam = resolvedPlayers.map(p => {
    const team = inferTeam(p);
    if (!team) return p;
    return { ...p, team };
  });

  const playersWithMinutesAndPosition = resolvedWithTeam.map(p => {
    const baseKeys = [p.name, p.canonicalName].filter(Boolean).map(normalizeName);
    const numberSuffix = p.number != null ? `#${p.number}` : "";
    const keys = [
      ...baseKeys,
      ...baseKeys.map(k => `${k}${numberSuffix}`)
    ];

    let minutes = 0;
    let position = p.position || null;

    for (const k of keys) {
      if (!minutes && normalizedMinutesByPlayer[k]) {
        minutes = normalizedMinutesByPlayer[k].totalMinutes || 0;
      }
      if (!position && normalizedPositionsByPlayer[k]) {
        position = normalizedPositionsByPlayer[k];
      }
    }

    return { ...p, minutesPlayed: minutes, position };
  });

  const uniquePlayersMap = new Map();
  for (const p of playersWithMinutesAndPosition) {
    const normName = normalizeName(p.canonicalName || p.name);
    const key =
      p.playerId ||
      (normName === "a bucsa" && p.number == null
        ? `${normName}|${p.team || ""}|${p._idx ?? ""}`
        : `${normName}|${p.team || ""}|${p.number ?? ""}`);
    const existing = uniquePlayersMap.get(key);
    if (!existing) {
      uniquePlayersMap.set(key, p);
      continue;
    }

    uniquePlayersMap.set(key, {
      ...existing,
      position: existing.position || p.position,
      minutesPlayed: Math.max(existing.minutesPlayed || 0, p.minutesPlayed || 0),
      // If any entry is a substitute, keep substitute classification.
      starter: Boolean(existing.starter && p.starter)
    });
  }

  const uniquePlayersWithMinutesAndPosition = Array.from(uniquePlayersMap.values());

  // Enforce up to 11 starters per side using minutes/order as tiebreakers
  for (const side of ["home", "away"]) {
    const sidePlayers = uniquePlayersWithMinutesAndPosition
      .filter(p => p.team === side)
      .sort((a, b) => {
        const starterScore = Number(Boolean(b.starter)) - Number(Boolean(a.starter));
        if (starterScore !== 0) return starterScore;
        const mins = (b.minutesPlayed || 0) - (a.minutesPlayed || 0);
        if (mins !== 0) return mins;
        const idxA = a._idx ?? Number.MAX_SAFE_INTEGER;
        const idxB = b._idx ?? Number.MAX_SAFE_INTEGER;
        return idxA - idxB;
      });

    sidePlayers.forEach((p, idx) => {
      if (idx < 11) {
        p.starter = true;
      } else {
        p.starter = false;
      }
    });
  }

  const cleanedPlayers = uniquePlayersWithMinutesAndPosition.map(
    ({ minuteHints, _idx, ...rest }) => rest
  );

  console.log(
    "FINAL players (minutes+pos):",
    cleanedPlayers.map(p => ({
      name: p.name,
      canonical: p.canonicalName,
      minutes: p.minutesPlayed,
      position: p.position
    }))
  );

  const seasonGrades = await loadSeasonGrades(
    cleanedPlayers.map(p => p.playerId)
  );

  const matchId = buildMatchId({
    date: parsed.date || null,
    round: parsed.round || null,
    homeTeam: parsed.homeTeam,
    awayTeam: parsed.awayTeam
  });

  console.log("Match ID:", matchId);

  const processed = processMatch({
    ...parsed,
    players: cleanedPlayers,
    homeTeamId,
    awayTeamId,
    seasonGradesMap: seasonGrades
  });
  console.log("positionsByPlayer sample:", Object.entries(parsed.positionsByPlayer).slice(0, 20));

  const bestPerformers = processed.bestPerformers || processed.bestPerformer || {};

  const bestPerformerNotesRaw = await generateTeamHighlights({
    match: {
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      score: parsed.score,
      date: parsed.date
    },
    bestPerformers
  });

  let excelNotes = {};
  let gpsByPlayerId = new Map();
  if (metricsBuffer) {
    try {
      const metrics = parseExcelMetrics(metricsBuffer);
      const norm = str =>
        String(str || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z\s.]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const byTeam = { home: [], away: [] };
      const matchedRows = [];
      for (const row of metrics) {
        const matchPlayer = cleanedPlayers.find(p => {
          const numMatch = row.number != null && p.number != null && Number(p.number) === Number(row.number);
          const nameMatch =
            norm(p.canonicalName || p.name) === norm(row.name) ||
            norm(p.name) === norm(row.name);
          return numMatch || nameMatch;
        });
        if (matchPlayer?.team === "home" || matchPlayer?.team === "away") {
          byTeam[matchPlayer.team].push(row);
          matchedRows.push({ player: matchPlayer, row });
          if (matchPlayer.playerId) {
            gpsByPlayerId.set(matchPlayer.playerId, row);
          }
        }
      }

      excelNotes = {
        home: buildExcelHighlights(byTeam.home, parsed.homeTeam),
        away: buildExcelHighlights(byTeam.away, parsed.awayTeam)
      };

      console.log("GPS metrics loaded:", {
        file: metricsFilename,
        homeCount: byTeam.home.length,
        awayCount: byTeam.away.length
      });
    } catch (err) {
      console.error("Failed to parse GPS Excel:", err);
    }
  }

  const mergedNotes = {};
  for (const side of ["home", "away"]) {
    const parts = [];
    if (excelNotes[side]) parts.push(excelNotes[side]);
    if (bestPerformerNotesRaw?.[side]) parts.push(bestPerformerNotesRaw[side]);
    if (parts.length) mergedNotes[side] = parts.join(" | ");
  }

  const bestPerformerNotes = Object.fromEntries(
    Object.entries(mergedNotes || {}).filter(([, v]) => v)
  );

  const gpsMetrics =
    metricsBuffer && Object.keys(excelNotes).some(k => excelNotes[k])
      ? excelNotes
      : null;

  const buildGps = row => {
    if (!row) return null;
    const duration = row.durationMinutes || null;
    const dist = row.totalDistance || 0;
    const kmPer90 = duration ? (dist / duration) * (90 / 1000) : null;
    const gps = {
      totalDistanceMeters: dist || null,
      durationMinutes: duration,
      kmPer90,
      topSpeedKmh: row.maxSpeed ?? null,
      avgBpm: row.avgBpm ?? null,
      sprints: row.sprints ?? null
    };
    // drop gps if all fields are null
    const hasValue = Object.values(gps).some(v => v !== null);
    return hasValue ? gps : null;
  };

  const enrichedPlayers = cleanedPlayers.map(p => {
    const row = gpsByPlayerId.get(p.playerId);
    const gps = buildGps(row);
    return gps ? { ...p, gps } : p;
  });

  await saveMatch({
    ...processed,
    matchId,
    players: processed.players.map(pp => {
      const attach = enrichedPlayers.find(ep => ep.playerId === pp.playerId);
      return attach ? { ...pp, gps: attach.gps } : pp;
    }),
    // overwrite gpsMetrics entirely when metricsBuffer is provided
    ...(gpsMetrics ? { gpsMetrics } : { gpsMetrics: null })
  });

  console.log("Match saved successfully:", matchId);
  return matchId;
}
