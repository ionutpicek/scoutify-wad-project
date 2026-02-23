import { db } from "../firebase/firebaseAdmin.js";
import { computeDerivedMetrics } from "../grading/derivedMetrics.js";
import { detectPrimaryRole } from "../grading/roleDetector.js";

const MATCHES_COLLECTION = "matches";
const STATS_COLLECTION = "stats";

const PDF_SYNC_FIELDS = [
  // Common / attacking
  "goals",
  "assists",
  "shots",
  "shotsOnTarget",
  "xG",
  "shotAssists",
  "xA",
  "secondAssists",
  "touchesInPenaltyArea",
  "offsides",

  // Passing / creation
  "passes",
  "accuratePasses",
  "crosses",
  "crossesAccurate",
  "throughPasses",
  "throughPassesAccurate",
  "passesFinalThird",
  "passesFinalThirdAccurate",
  "forwardPasses",
  "forwardPassesAccurate",
  "backPasses",
  "backPassesAccurate",
  "longPasses",
  "longPassesAccurate",

  // Dribbling / duels / defending
  "dribbles",
  "dribblesSuccessful",
  "duels",
  "duelsWon",
  "aerialDuels",
  "aerialDuelsWon",
  "offensiveDuels",
  "offensiveDuelsWon",
  "defensiveDuels",
  "defensiveDuelsWon",
  "looseBallDuels",
  "looseBallDuelsWon",
  "slidingTackles",
  "slidingTacklesSuccessful",
  "interceptions",
  "losses",
  "lossesOwnHalf",
  "recoveries",
  "recoveriesOppHalf",
  "clearances",
  "fouls",
  "foulsSuffered",

  // Discipline
  "yellowCards",
  "redCards",

  // Goalkeeper (best effort when present in PDF parser)
  "concededGoals",
  "xCG",
  "shotsAgainst",
  "saves",
  "reflexSaves",
  "exits",
  "goalKicks",
  "shortGoalKicks",
  "longGoalKicks",
  "longGoalKicksAccurate"
];

const FIELD_SOURCE_PRIORITY = {
  goals: ["goals"],
  assists: ["assists"],
  shots: ["shots"],
  shotsOnTarget: ["shotsOnTarget", "shotsSuccess"],
  xG: ["xG"],
  shotAssists: ["shotAssists", "keyPasses"],
  xA: ["xA"],
  secondAssists: ["secondAssists"],
  touchesInPenaltyArea: ["touchesInPenaltyArea"],
  offsides: ["offsides"],

  passes: ["passes"],
  accuratePasses: ["accuratePasses", "passesSuccess"],
  crosses: ["crosses"],
  crossesAccurate: ["crossesAccurate", "crossesSuccess"],
  throughPasses: ["throughPasses"],
  throughPassesAccurate: ["throughPassesAccurate", "throughPassesSuccess"],
  passesFinalThird: ["passesFinalThird"],
  passesFinalThirdAccurate: ["passesFinalThirdAccurate", "passesFinalThirdSuccess"],
  forwardPasses: ["forwardPasses"],
  forwardPassesAccurate: ["forwardPassesAccurate", "forwardPassesSuccess"],
  backPasses: ["backPasses"],
  backPassesAccurate: ["backPassesAccurate", "backPassesSuccess"],
  longPasses: ["longPasses"],
  longPassesAccurate: ["longPassesAccurate", "longPassesSuccess"],

  dribbles: ["dribbles"],
  dribblesSuccessful: ["dribblesSuccessful", "dribblesSuccess"],
  duels: ["duels"],
  duelsWon: ["duelsWon", "duelsSuccess"],
  aerialDuels: ["aerialDuels"],
  aerialDuelsWon: ["aerialDuelsWon", "aerialDuelsSuccess"],
  offensiveDuels: ["offensiveDuels"],
  offensiveDuelsWon: ["offensiveDuelsWon", "offensiveDuelsSuccess"],
  defensiveDuels: ["defensiveDuels"],
  defensiveDuelsWon: ["defensiveDuelsWon", "defensiveDuelsSuccess"],
  looseBallDuels: ["looseBallDuels"],
  looseBallDuelsWon: ["looseBallDuelsWon", "looseBallDuelsSuccess"],
  slidingTackles: ["slidingTackles"],
  slidingTacklesSuccessful: ["slidingTacklesSuccessful", "slidingTacklesSuccess"],
  interceptions: ["interceptions"],
  losses: ["losses"],
  lossesOwnHalf: ["lossesOwnHalf", "lossesSuccess"],
  recoveries: ["recoveries"],
  recoveriesOppHalf: ["recoveriesOppHalf", "recoveriesSuccess"],
  clearances: ["clearances"],
  fouls: ["fouls"],
  foulsSuffered: ["foulsSuffered"],
  yellowCards: ["yellowCards"],
  redCards: ["redCards"],

  concededGoals: ["concededGoals"],
  xCG: ["xCG"],
  shotsAgainst: ["shotsAgainst"],
  saves: ["saves"],
  reflexSaves: ["reflexSaves"],
  exits: ["exits"],
  goalKicks: ["goalKicks"],
  shortGoalKicks: ["shortGoalKicks"],
  longGoalKicks: ["longGoalKicks"],
  longGoalKicksAccurate: ["longGoalKicksAccurate", "longGoalKicksSuccess"]
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildEmptyTotals() {
  const out = {};
  for (const field of PDF_SYNC_FIELDS) out[field] = 0;
  return out;
}

function normalizeIsoDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const dt = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return trimmed;
}

function getSeasonWindowFromDate(dateIso) {
  const normalized = normalizeIsoDate(dateIso);
  if (!normalized) {
    throw new Error(`Invalid match date for PDF stats sync: ${dateIso}`);
  }

  const [yearStr, monthStr] = normalized.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    seasonKey: `${startYear}-${endYear}`,
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`
  };
}

function getPreferredNumeric(rawStats, sourceKeys = []) {
  if (!rawStats || typeof rawStats !== "object") return null;
  for (const key of sourceKeys) {
    const n = toNumber(rawStats[key]);
    if (n != null) return n;
  }
  return null;
}

function extractCanonicalMatchStats(rawStats) {
  const out = {};
  if (!rawStats || typeof rawStats !== "object") return out;

  for (const field of PDF_SYNC_FIELDS) {
    const value = getPreferredNumeric(rawStats, FIELD_SOURCE_PRIORITY[field] || [field]);
    if (value != null) out[field] = value;
  }

  return out;
}

function addRoleMinutes(agg, player, minutesPlayed) {
  const roleMinutes = player?.roleMinutes;
  let addedAny = false;

  if (roleMinutes && typeof roleMinutes === "object") {
    for (const [posRaw, minsRaw] of Object.entries(roleMinutes)) {
      const pos = String(posRaw || "").trim();
      const mins = toNumber(minsRaw);
      if (!pos || mins == null || mins <= 0) continue;
      agg.roleMinutes[pos] = (agg.roleMinutes[pos] || 0) + mins;
      agg.positions.add(pos);
      addedAny = true;
    }
  }

  if (!addedAny) {
    const pos = String(player?.position || "").trim();
    if (pos && minutesPlayed > 0) {
      agg.roleMinutes[pos] = (agg.roleMinutes[pos] || 0) + minutesPlayed;
      agg.positions.add(pos);
    }
  } else if (player?.position) {
    agg.positions.add(String(player.position).trim());
  }
}

function incrementRoleCount(agg, rolePlayed) {
  const role = String(rolePlayed || "").trim();
  if (!role) return;
  agg.roleCounts[role] = (agg.roleCounts[role] || 0) + 1;
}

function pickFallbackRole(roleCounts) {
  const entries = Object.entries(roleCounts || {});
  if (!entries.length) return "GENERIC";
  entries.sort((a, b) => {
    const diff = (b[1] || 0) - (a[1] || 0);
    if (diff !== 0) return diff;
    return String(a[0]).localeCompare(String(b[0]));
  });
  return entries[0][0] || "GENERIC";
}

function buildPlayerStatsPayload(agg, seasonInfo) {
  const totals = {};
  for (const field of PDF_SYNC_FIELDS) {
    totals[field] = round2(agg.totals[field] || 0);
  }

  const roleMinutes = {};
  for (const [pos, mins] of Object.entries(agg.roleMinutes)) {
    roleMinutes[pos] = round2(mins);
  }

  const positions = Array.from(agg.positions)
    .map(pos => String(pos || "").trim())
    .filter(Boolean);

  const fallbackRole = pickFallbackRole(agg.roleCounts);
  const roleProfile = detectPrimaryRole(positions, fallbackRole);

  const minutes = round2(agg.minutes);
  const payload = {
    playerID: agg.playerID,
    ...totals,
    minutes,
    games: agg.games,
    positions,
    roleMinutes,
    roleProfile,
    primaryRole: roleProfile.primaryRole,
    derived: computeDerivedMetrics({
      ...totals,
      minutes,
      primaryRole: roleProfile.primaryRole,
      positions
    }),
    pdfStatsSource: "match-pdf",
    pdfStatsSeasonKey: seasonInfo.seasonKey,
    pdfStatsUpdatedAt: new Date()
  };

  if (agg.firstGameDate) payload.firstGameDate = agg.firstGameDate;
  if (agg.lastGameDate) payload.lastGameDate = agg.lastGameDate;

  return payload;
}

function createAccumulator(playerID) {
  return {
    playerID,
    totals: buildEmptyTotals(),
    minutes: 0,
    games: 0,
    positions: new Set(),
    roleMinutes: {},
    roleCounts: {},
    firstGameDate: null,
    lastGameDate: null
  };
}

function hasMatchContribution(player, minutesPlayed, canonicalStats) {
  if (minutesPlayed > 0) return true;
  if (player?.starter) return true;
  return Object.values(canonicalStats).some(v => (Number(v) || 0) !== 0);
}

function updateDateRange(agg, dateIso) {
  const d = normalizeIsoDate(dateIso);
  if (!d) return;
  if (!agg.firstGameDate || d < agg.firstGameDate) agg.firstGameDate = d;
  if (!agg.lastGameDate || d > agg.lastGameDate) agg.lastGameDate = d;
}

function mergeUniqueStrings(existing = [], additions = []) {
  return Array.from(
    new Set(
      [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(additions) ? additions : [])]
        .map(v => String(v || "").trim())
        .filter(Boolean)
    )
  );
}

function mergeRoleMinutesObjects(existingRoleMinutes = {}, player, minutesPlayed) {
  const out = {};
  if (existingRoleMinutes && typeof existingRoleMinutes === "object") {
    for (const [pos, mins] of Object.entries(existingRoleMinutes)) {
      const posKey = String(pos || "").trim();
      const num = toNumber(mins);
      if (!posKey || num == null) continue;
      out[posKey] = num;
    }
  }

  const roleMinutes = player?.roleMinutes;
  let added = false;
  if (roleMinutes && typeof roleMinutes === "object") {
    for (const [pos, mins] of Object.entries(roleMinutes)) {
      const posKey = String(pos || "").trim();
      const num = toNumber(mins);
      if (!posKey || num == null || num <= 0) continue;
      out[posKey] = (out[posKey] || 0) + num;
      added = true;
    }
  }

  if (!added) {
    const pos = String(player?.position || "").trim();
    if (pos && minutesPlayed > 0) {
      out[pos] = (out[pos] || 0) + minutesPlayed;
    }
  }

  const rounded = {};
  for (const [pos, mins] of Object.entries(out)) {
    rounded[pos] = round2(mins);
  }
  return rounded;
}

function clampArrayLength(arr, maxLen = 200) {
  if (!Array.isArray(arr) || arr.length <= maxLen) return Array.isArray(arr) ? arr : [];
  return arr.slice(arr.length - maxLen);
}

export function aggregatePdfStatsFromMatches(matches, targetPlayerIds, seasonInfo) {
  const targetIds = new Set((targetPlayerIds || []).filter(Boolean));
  const byPlayer = new Map();

  if (!targetIds.size) return byPlayer;

  for (const match of Array.isArray(matches) ? matches : []) {
    const matchDate = normalizeIsoDate(match?.date);
    if (matchDate && (matchDate < seasonInfo.startDate || matchDate > seasonInfo.endDate)) {
      continue;
    }

    const players = Array.isArray(match?.players) ? match.players : [];
    for (const p of players) {
      const playerID = p?.playerId || p?.playerID;
      if (!targetIds.has(playerID)) continue;

      if (!byPlayer.has(playerID)) {
        byPlayer.set(playerID, createAccumulator(playerID));
      }
      const agg = byPlayer.get(playerID);

      const minutesPlayed = Math.max(0, toNumber(p?.minutesPlayed) || 0);
      const canonicalStats = extractCanonicalMatchStats(p?.matchStats);
      const contributed = hasMatchContribution(p, minutesPlayed, canonicalStats);

      if (contributed) {
        agg.minutes += minutesPlayed;
        if (minutesPlayed > 0) {
          agg.games += 1;
        }
        addRoleMinutes(agg, p, minutesPlayed);
        incrementRoleCount(agg, p?.rolePlayed);
        updateDateRange(agg, matchDate);
      }

      for (const [field, value] of Object.entries(canonicalStats)) {
        agg.totals[field] = (agg.totals[field] || 0) + (toNumber(value) || 0);
      }
    }
  }

  return byPlayer;
}

async function loadExistingStatsDocs(playerIds) {
  const docsByPlayerId = new Map();
  const unique = [...new Set((playerIds || []).filter(Boolean))];
  if (!unique.length) return docsByPlayerId;

  // Firestore "in" queries support up to 10 values.
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await db
      .collection(STATS_COLLECTION)
      .where("playerID", "in", chunk)
      .get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const playerID = data.playerID;
      if (playerID) {
        docsByPlayerId.set(playerID, {
          ref: docSnap.ref,
          data
        });
      }
    }
  }

  return docsByPlayerId;
}

export async function syncPdfSeasonStatsForMatch({ matchId, match }) {
  const matchDate = normalizeIsoDate(match?.date);
  const seasonInfo = getSeasonWindowFromDate(matchDate);

  const importedPlayers = Array.isArray(match?.players) ? match.players : [];
  const targetPlayerIds = [
    ...new Set(
      importedPlayers
        .filter(p => (p?.minutesPlayed || 0) > 0 || (p?.matchStats && Object.keys(p.matchStats).length))
        .map(p => p?.playerId || p?.playerID)
        .filter(Boolean)
    )
  ];

  if (!targetPlayerIds.length) {
    return {
      ok: true,
      matchId,
      seasonKey: seasonInfo.seasonKey,
      updatedPlayers: 0,
      skippedPlayers: importedPlayers.filter(p => !p?.playerId && !p?.playerID).length,
      matchesScanned: 0
    };
  }

  const existingDocs = await loadExistingStatsDocs(targetPlayerIds);

  const batch = db.batch();
  let writes = 0;
  let skippedAlreadyApplied = 0;
  const seenPlayerIds = new Set();

  for (const player of importedPlayers) {
    const playerID = player?.playerId || player?.playerID;
    if (!playerID) continue;
    if (seenPlayerIds.has(playerID)) continue;
    seenPlayerIds.add(playerID);

    const minutesPlayed = Math.max(0, toNumber(player?.minutesPlayed) || 0);
    const matchStatsDelta = extractCanonicalMatchStats(player?.matchStats);
    const contributed = hasMatchContribution(player, minutesPlayed, matchStatsDelta);
    if (!contributed) continue;

    const existingDoc = existingDocs.get(playerID);
    const existing = existingDoc?.data || {};
    const alreadyAppliedIds = Array.isArray(existing.pdfAppliedMatchIds)
      ? existing.pdfAppliedMatchIds.map(v => String(v))
      : [];

    if (alreadyAppliedIds.includes(String(matchId))) {
      skippedAlreadyApplied += 1;
      continue;
    }

    const nextTotals = {};
    for (const field of PDF_SYNC_FIELDS) {
      const prev = toNumber(existing[field]) || 0;
      const inc = toNumber(matchStatsDelta[field]) || 0;
      nextTotals[field] = round2(prev + inc);
    }

    const nextMinutes = round2((toNumber(existing.minutes) || 0) + minutesPlayed);
    const nextGames = Math.max(
      0,
      Math.round((toNumber(existing.games) || 0) + (minutesPlayed > 0 ? 1 : 0))
    );
    const nextRoleMinutes = mergeRoleMinutesObjects(existing.roleMinutes, player, minutesPlayed);
    const nextPositions = mergeUniqueStrings(existing.positions, [
      ...Object.keys(nextRoleMinutes || {}),
      player?.position
    ]);

    const fallbackRole =
      (existing.roleProfile && existing.roleProfile.primaryRole) ||
      (typeof existing.primaryRole === "string" ? existing.primaryRole : null) ||
      (typeof player?.rolePlayed === "string" ? player.rolePlayed : null) ||
      "GENERIC";
    const roleProfile = detectPrimaryRole(nextPositions, fallbackRole);

    const firstGameDateExisting = normalizeIsoDate(existing.firstGameDate);
    const lastGameDateExisting = normalizeIsoDate(existing.lastGameDate);
    const firstGameDate =
      matchDate && firstGameDateExisting
        ? (matchDate < firstGameDateExisting ? matchDate : firstGameDateExisting)
        : (matchDate || firstGameDateExisting || null);
    const lastGameDate =
      matchDate && lastGameDateExisting
        ? (matchDate > lastGameDateExisting ? matchDate : lastGameDateExisting)
        : (matchDate || lastGameDateExisting || null);

    const mergedForDerived = {
      ...existing,
      ...nextTotals,
      minutes: nextMinutes,
      games: nextGames,
      roleMinutes: nextRoleMinutes,
      positions: nextPositions,
      primaryRole: roleProfile.primaryRole
    };

    const pdfAppliedMatchIds = clampArrayLength([...alreadyAppliedIds, String(matchId)]);

    const payload = {
      playerID,
      ...nextTotals,
      minutes: nextMinutes,
      games: nextGames,
      roleMinutes: nextRoleMinutes,
      positions: nextPositions,
      roleProfile,
      primaryRole: roleProfile.primaryRole,
      derived: computeDerivedMetrics({
        ...mergedForDerived,
        positions: nextPositions,
        primaryRole: roleProfile.primaryRole
      }),
      pdfStatsSource: "match-pdf-incremental",
      pdfStatsSeasonKey: seasonInfo.seasonKey,
      pdfStatsUpdatedAt: new Date(),
      pdfLastAppliedMatchId: String(matchId),
      pdfAppliedMatchIds
    };

    if (firstGameDate) payload.firstGameDate = firstGameDate;
    if (lastGameDate) payload.lastGameDate = lastGameDate;

    const ref = existingDoc?.ref || db.collection(STATS_COLLECTION).doc();
    batch.set(ref, payload, { merge: true });
    writes += 1;
  }

  if (writes > 0) {
    await batch.commit();
  }

  return {
    ok: true,
    matchId,
    mode: "incremental-current-plus-match",
    seasonKey: seasonInfo.seasonKey,
    updatedPlayers: writes,
    skippedAlreadyApplied,
    skippedPlayers: importedPlayers.filter(p => !p?.playerId && !p?.playerID).length,
    matchesScanned: 0
  };
}
