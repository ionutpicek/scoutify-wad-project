// src/matches/extractMatchStats.js

import { extractFieldPlayerStats } from "./extractMatchStatsFieldPlayers.js";
import { extractGoalkeeperStats } from "./extractMatchStatsGoalkeepers.js";

const NAME_ALIASES = new Map([
  ["b lenovan", "b ienovan"],
  ["lenovan", "ienovan"]
]);

function normalizeName(str) {
  const normalized = String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return NAME_ALIASES.get(normalized) || normalized;
}

export function extractMatchStats(text, players = []) {
  const jerseyBuckets = new Map();
  const jerseyUsed = new Set();
  const jerseyByKey = new Map(); // `${canonical}|m${minutes}`

  players.forEach((p, idx) => {
    const name = p.name;
    if (!jerseyBuckets.has(name)) jerseyBuckets.set(name, []);
    jerseyBuckets.get(name).push({
      number: p.number,
      minutes: Number(p.minutesPlayed || 0),
      starter: Boolean(p.starter),
      order: idx
    });
  });

  for (const arr of jerseyBuckets.values()) {
    arr.sort((a, b) => {
      const s = Number(b.starter) - Number(a.starter);
      if (s !== 0) return s;
      const m = (b.minutes || 0) - (a.minutes || 0);
      if (m !== 0) return m;
      const o = (a.order ?? 0) - (b.order ?? 0);
      if (o !== 0) return o;
      return (a.number || 0) - (b.number || 0);
    });
  }

  const resolveJerseyFromPlayers = (canonical, minutesTok) => {
    const key = `${canonical}|m${minutesTok || "?"}`;
    const bucket = jerseyBuckets.get(canonical);
    if (!bucket || !bucket.length) return null;
    const hasDupes = bucket.length > 1;
    if (!hasDupes && jerseyByKey.has(key)) return jerseyByKey.get(key);
    const minutesNum = Number(minutesTok || 0);
    let pick = bucket.find(
      p => p.minutes === minutesNum && p.number != null && !jerseyUsed.has(`${canonical}|#${p.number}`)
    );
    if (!pick) {
      pick = bucket.find(p => p.number != null && !jerseyUsed.has(`${canonical}|#${p.number}`)) || bucket[0];
    }
    if (pick && pick.number != null) {
      jerseyUsed.add(`${canonical}|#${pick.number}`);
      if (!hasDupes) {
        jerseyByKey.set(key, pick.number);
      }
      return pick.number;
    }
    return null;
  };

  const statsByPlayer = {};
  const nameByNorm = new Map();
  const nameByNormWithNumber = new Map();
  for (const p of players) {
    const candidates = [p.name, p.canonicalName, p.abbrName]
      .filter(Boolean)
      .map(normalizeName);
    // Add simple abbreviation: "F. Lastname"
    if (p.name) {
      const parts = String(p.name).trim().split(/\s+/);
      if (parts.length >= 2) {
        const abbr = `${parts[0][0]}. ${parts.slice(-1)[0]}`;
        candidates.push(normalizeName(abbr));
      }
    }
    const jersey = p.number != null ? String(p.number) : null;
    for (const c of candidates) {
      if (!nameByNorm.has(c)) {
        nameByNorm.set(c, p.name || p.canonicalName || p.abbrName);
      }
      if (jersey) {
        const key = `${c}|${jersey}`;
        if (!nameByNormWithNumber.has(key)) {
          nameByNormWithNumber.set(key, p.name || p.canonicalName || p.abbrName);
        }
      }
    }
  }

  const fieldStats = extractFieldPlayerStats(text, {
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers,
    normalizeName
  });
  for (const [playerName, payload] of Object.entries(fieldStats)) {
    if (!statsByPlayer[playerName]) statsByPlayer[playerName] = { stats: {} };
    Object.assign(statsByPlayer[playerName].stats, payload.stats);
  }

  const gkStats = extractGoalkeeperStats(text, {
    nameByNorm,
    normalizeName,
    players
  });
  for (const [playerName, payload] of Object.entries(gkStats)) {
    if (!statsByPlayer[playerName]) statsByPlayer[playerName] = { stats: {} };
    Object.assign(statsByPlayer[playerName].stats, payload.stats);
  }

  // If multiple players share the same canonical name (e.g., sisters with same initial/last name)
  // and we only captured stats without a jersey, duplicate those stats to missing jersey entries.
  for (const [canonical, bucket] of jerseyBuckets.entries()) {
    if (!bucket || bucket.length <= 1) continue;
    const existingNumbers = new Set();
    const candidates = [];
    for (const [key, value] of Object.entries(statsByPlayer)) {
      if (key === canonical || key.startsWith(`${canonical}|`)) {
        const numPart = key.split("|").find(p => p.startsWith("#"));
        if (numPart) existingNumbers.add(numPart.replace("#", ""));
        candidates.push(value?.stats || value || {});
      }
    }
    if (!candidates.length) continue;
    const bestStats =
      candidates.reduce((best, item) => {
        const bestScore = best ? Object.keys(best).length : -1;
        const score = item ? Object.keys(item).length : -1;
        return score > bestScore ? item : best;
      }, null) || {};

    for (const entry of bucket) {
      const num = entry.number != null ? String(entry.number) : null;
      if (!num || existingNumbers.has(num)) continue;
      statsByPlayer[`${canonical}|#${num}`] = {
        stats: { ...bestStats }
      };
    }
  }

  return statsByPlayer;
}
