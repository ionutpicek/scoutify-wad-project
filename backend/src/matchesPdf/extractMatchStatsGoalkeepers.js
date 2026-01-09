// src/matches/extractMatchStatsGoalkeepers.js

function resolveGkName(blockText, nameByNorm, normalizeName, players = []) {
  const normBlock = normalizeName(blockText);
  let best = null;

  for (const [norm, canonical] of nameByNorm.entries()) {
    if (!norm) continue;

    const posFull = normBlock.indexOf(norm);
    const last = norm.split(" ").pop();
    const posLast = last ? normBlock.indexOf(` ${last}`) : -1;

    const hitPos = [posFull, posLast].filter(p => p >= 0).sort((a, b) => a - b)[0];
    if (hitPos != null && hitPos >= 0 && (!best || hitPos < best.pos)) {
      best = { name: canonical, pos: hitPos };
    }
  }

  if (best) return best.name;

  if (players.length) {
    const tokens = new Set(normBlock.split(/\s+/).filter(Boolean));
    for (const p of players) {
      const norm = normalizeName(p.name);
      const last = norm.split(" ").pop();
      if (last && tokens.has(last)) return p.name;
    }
  }

  return null;
}

function parseGkRatio(blockText, label) {
  const lower = blockText.toLowerCase();
  // Allow up to 4 digits to catch glued percent tokens, then trim down.
  const re = new RegExp(`${label}\\s*(\\d{1,3})\\s*/\\s*(\\d{1,4})`);
  const m = lower.match(re);
  if (!m) return null;
  const attempts = Number(m[1]) || 0;
  let successStr = m[2] || "";
  let success = Number(successStr) || 0;

  if (success > attempts && successStr.length > 1) {
    let best = null;
    for (let len = 1; len <= successStr.length; len++) {
      const cand = Number(successStr.slice(0, len));
      if (Number.isFinite(cand) && cand <= attempts) {
        best = cand;
      }
    }
    if (best != null) success = best;
  }

  if (success > attempts) success = attempts;
  return { attempts, success };
}

function parseGkTotals(raw) {
  if (!raw) return 0;
  const rawStr = String(raw);
  // If there is whitespace, take the first integer chunk (likely the match column).
  if (/\s/.test(rawStr)) {
    const firstInt = rawStr.match(/\d+/);
    if (firstInt && firstInt[0]) return Number(firstInt[0]) || 0;
  }
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return 0;
  // Common formats:
  // 624 -> total 6 (1H=2, 2H=4)
  // 1055 -> total 10 (1H=5, 2H=5)
  if (digits.length >= 4) {
    return Number(digits.slice(0, 2)) || 0;
  }
  if (digits.length === 3) {
    return Number(digits[0]) || 0;
  }
  return Number(digits) || 0;
}

function addStat(statsByPlayer, playerName, key, attempts, success = null) {
  if (!statsByPlayer[playerName]) {
    statsByPlayer[playerName] = { stats: {} };
  }

  statsByPlayer[playerName].stats[key] = {
    attempts: Number(attempts) || 0,
    success: success == null ? null : Number(success) || 0
  };
}

function extractGoalkeeperStatsStrict(text, nameByNorm, normalizeName, players = []) {
  const statsByPlayer = {};
  const lower = text.toLowerCase();
  let idx = lower.indexOf("goalkeeper in match");

  while (idx !== -1) {
    const block = text.slice(Math.max(0, idx - 400), idx + 500);
    const markerSlice = text.slice(idx, idx + 200);
    const canonical =
      resolveGkName(markerSlice, nameByNorm, normalizeName, players) ||
      resolveGkName(block, nameByNorm, normalizeName, players);

    if (canonical) {
      // passes / accurate (match column)
      const passRatio = parseGkRatio(block, "passes\\s*/\\s*accurate");
      if (passRatio) {
        addStat(statsByPlayer, canonical, "passes", passRatio.attempts, passRatio.success);
      }

      const tokRegex = /(shots against|conceded goals|saves|reflex saves|exits)\s*([0-9]{1,4})/gi;
      let t;
      while ((t = tokRegex.exec(block.toLowerCase())) !== null) {
        const keyRaw = t[1].toLowerCase();
        const numRaw = t[2];
        const total = parseGkTotals(numRaw);

        switch (keyRaw) {
          case "shots against":
            addStat(statsByPlayer, canonical, "shotsAgainst", total, null);
            break;
          case "conceded goals":
            addStat(statsByPlayer, canonical, "concededGoals", total, null);
            break;
          case "saves":
            addStat(statsByPlayer, canonical, "saves", total, null);
            break;
          case "reflex saves":
            addStat(statsByPlayer, canonical, "reflexSaves", total, null);
            break;
          case "exits":
            addStat(statsByPlayer, canonical, "exits", total, null);
            break;
          default:
            break;
        }
      }
    }

    idx = lower.indexOf("goalkeeper in match", idx + 1);
  }

  return statsByPlayer;
}

function extractGoalkeeperStatsLoose(text, normalizeName, players = []) {
  const statsByPlayer = {};
  const lower = text.toLowerCase();

  let idx = lower.indexOf("goalkeeper in match");
  while (idx !== -1) {
    const block = text.slice(Math.max(0, idx - 400), idx + 500);
    const markerSlice = text.slice(idx, idx + 200);
    const canonical =
      resolveGkName(markerSlice, new Map(), normalizeName, players) ||
      resolveGkName(block, new Map(), normalizeName, players);

    if (canonical) {
      const passRatio = parseGkRatio(block, "passes\\s*/\\s*accurate");
      if (passRatio) {
        addStat(statsByPlayer, canonical, "passes", passRatio.attempts, passRatio.success);
      }

      const tokRegex = /(shots against|conceded goals|saves|reflex saves|exits)\s*([0-9]{1,4})/gi;
      let t;
      while ((t = tokRegex.exec(block.toLowerCase())) !== null) {
        const keyRaw = t[1].toLowerCase();
        const total = parseGkTotals(t[2]);
        switch (keyRaw) {
          case "shots against":
            addStat(statsByPlayer, canonical, "shotsAgainst", total, null);
            break;
          case "conceded goals":
            addStat(statsByPlayer, canonical, "concededGoals", total, null);
            break;
          case "saves":
            addStat(statsByPlayer, canonical, "saves", total, null);
            break;
          case "reflex saves":
            addStat(statsByPlayer, canonical, "reflexSaves", total, null);
            break;
          case "exits":
            addStat(statsByPlayer, canonical, "exits", total, null);
            break;
          default:
            break;
        }
      }
    }
    idx = lower.indexOf("goalkeeper in match", idx + 1);
  }
  return statsByPlayer;
}

function forceAddGoalkeeperStats(text, normalizeName, players, statsByPlayer) {
  if (!players?.length) return;
  const lower = text.toLowerCase();
  let idx = lower.indexOf("goalkeeper in match");
  while (idx !== -1) {
    const block = text.slice(Math.max(0, idx - 400), idx + 500);
    const markerSlice = text.slice(idx, idx + 200);
    const playerName =
      resolveGkName(markerSlice, new Map(), normalizeName, players) ||
      resolveGkName(block, new Map(), normalizeName, players);
    if (playerName) {
      const passRatio = parseGkRatio(block, "passes\\s*/\\s*accurate");
      if (passRatio) {
        addStat(statsByPlayer, playerName, "passes", passRatio.attempts, passRatio.success);
      }

      const tokRegex = /(shots against|conceded goals|saves|reflex saves|exits)\s*([0-9]{1,4})/gi;
      let t;
      while ((t = tokRegex.exec(block.toLowerCase())) !== null) {
        const keyRaw = t[1].toLowerCase();
        const total = parseGkTotals(t[2]);
        const mapKey = {
          "shots against": "shotsAgainst",
          "conceded goals": "concededGoals",
          "saves": "saves",
          "reflex saves": "reflexSaves",
          "exits": "exits"
        }[keyRaw];
        if (mapKey) {
          addStat(statsByPlayer, playerName, mapKey, total, null);
        }
      }
    }
    idx = lower.indexOf("goalkeeper in match", idx + 1);
  }
}

export function extractGoalkeeperStats(text, { nameByNorm, normalizeName, players = [] }) {
  const gkStats = extractGoalkeeperStatsStrict(text, nameByNorm, normalizeName, players);
  const gkStatsLoose = extractGoalkeeperStatsLoose(text, normalizeName, players);
  const merged = { ...gkStats, ...gkStatsLoose };
  forceAddGoalkeeperStats(text, normalizeName, players, merged);
  return merged;
}
