// src/matches/extractMatchStatsFieldPlayers.js

function resolveCanonical(norm, jersey, nameByNorm, nameByNormWithNumber) {
  if (jersey && nameByNormWithNumber) {
    const hit = nameByNormWithNumber.get(`${norm}|${jersey}`);
    if (hit) return hit;
  }
  return nameByNorm?.get(norm);
}

function parseRatioPair(attemptsStr, rightStr, { forceCount = false } = {}) {
  const attempts = Number(attemptsStr) || 0;
  const right = String(rightStr || "").replace(/%/g, "");

  if (!right) {
    return { attempts, success: null };
  }

  if (right.includes(".")) {
    return {
      attempts,
      success: null,
      isDecimal: true,
      rawRight: right,
      decimal: Number(right)
    };
  }

  if (!forceCount && /^\d+$/.test(right)) {
    const percentVal = Number(right);
    if (percentVal >= 0 && percentVal <= 100) {
      return {
        attempts,
        success: attempts ? Math.round((attempts * percentVal) / 100) : 0
      };
    }
  }

  // When forceCount is true we sometimes get the percent digits glued to the success
  // (e.g., "59/1424" meaning 59/14 with 24%). Trim the last two digits if that yields
  // a plausible success count.
  if (forceCount && /^\d{3,}$/.test(right)) {
    const cand = Number(right.slice(0, -2));
    if (cand > 0 && cand <= attempts) {
      return {
        attempts,
        success: cand
      };
    }
  }

  // Two-digit glued percents (e.g., "41" where attempts=8 -> success=4, 1%)
  if (forceCount && right.length === 2 && Number(right) > attempts) {
    const cand = Number(right[0]);
    if (cand > 0 && cand <= attempts) {
      return { attempts, success: cand };
    }
  }

  let successStr = right;
  if (right.endsWith("100")) {
    successStr = right.slice(0, -3);
  } else if (right.length > 2) {
    successStr = right.slice(0, -2);
  }

  const success = Number(successStr) || 0;
  return {
    attempts,
    success: success > attempts ? attempts : success
  };
}

function parseRatioTail(tail, maxTokens = 16) {
  // Fix glued percents after ratios, e.g. "59/1424" -> "59/14 24"
  const pctFixed = String(tail || "").replace(/(\d{1,3}\/\d{1,3})(\d{2,3})(?!\d)/g, "$1 $2");
  const ratios = [];
  const normalized = pctFixed
    .replace(/-/g, " - ")
    .replace(/(\d+\/\d{1,2}?)(\d{1,2}\/)/g, "$1 $2"); // split glued ratios like 9/518/1
  // Allow up to 4 digits on the right to keep success+percent glued (e.g., 19/1368)
  const ratioRegex = /^(\d{1,3}\/\d{1,4}(?:\.\d{1,2})?%?)/;

  let idx = 0;
  while (idx < normalized.length && ratios.length < maxTokens) {
    const ch = normalized[idx];
    if (ch === "-") {
      ratios.push(null);
      idx += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      idx += 1;
      continue;
    }

    const slice = normalized.slice(idx);
    const match = slice.match(ratioRegex);
    if (match) {
      const token = match[1];
      const parts = token.split("/");
      if (parts.length === 2) {
        const parsed = parseRatioPair(parts[0], parts[1], { forceCount: true });
        // Drop clearly bad tokens (glued numbers like 10811)
        if (parsed.attempts > 200 || (parsed.success || 0) > 200) {
          ratios.push(null);
        } else {
          ratios.push(parsed);
        }
      }
      idx += token.length;
      continue;
    }

    idx += 1;
  }

  return ratios;
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

function applyTableRatios(statsByPlayer, playerName, ratios, ratioMatches = []) {
  // Observed columns: Goals/xG, Assists/xA, Actions/successful, Shots/on target,
  // Passes/accurate, Crosses/accurate, Dribbles/successful, Duels/won,
  // Losses/own half, Recoveries/opponent half
  const cols = ["shots", "passes", "crosses", "dribbles", "duels", "losses", "recoveries"];
  const actions = ratios?.[2]?.attempts ?? 0;

  if (!statsByPlayer[playerName]) {
    statsByPlayer[playerName] = { stats: {} };
  }

  const prevActions = statsByPlayer[playerName]._tableActions ?? -1;
  if (actions < prevActions) return;

  // If this row is better (more actions), reset previously imported table fields
  const tableKeys = new Set([
    "goals",
    "assists",
    "xG",
    "xA",
    "totalActions",
    "successfulActions",
    "yellowCards",
    "redCards",
    ...cols
  ]);
  if (actions > prevActions) {
    for (const key of tableKeys) {
      delete statsByPlayer[playerName].stats[key];
    }
  }

  // Goals / xG (match column)
  const goalsTok = ratios?.[0];
  if (goalsTok) {
    addStat(statsByPlayer, playerName, "goals", goalsTok.attempts, null);
    if (goalsTok.decimal != null) {
      addStat(statsByPlayer, playerName, "xG", goalsTok.decimal, null);
    }
  }

  // Assists / xA (match column)
  const assistsTok = ratios?.[1];
  if (assistsTok) {
    addStat(statsByPlayer, playerName, "assists", assistsTok.attempts, null);
    if (assistsTok.decimal != null) {
      addStat(statsByPlayer, playerName, "xA", assistsTok.decimal, null);
    }
  }

  const actionsTok = ratios?.[2];
  if (actionsTok) {
    addStat(statsByPlayer, playerName, "totalActions", actionsTok.attempts, null);
    if (actionsTok.success != null) {
      addStat(statsByPlayer, playerName, "successfulActions", actionsTok.success, null);
    }
  }

  statsByPlayer[playerName]._tableActions = actions;

  let tokens = ratios.slice(3); // drop goals/xG, assists/xA and actions/successful

  // Prefer raw ratioMatches (from the line) when they are present
  if (ratioMatches && ratioMatches.length) {
    const rm = ratioMatches;
    // If we have goal/assist/actions plus columns length
    if (rm.length >= 3) {
      // Drop first three (goals, assists, actions) when present
      tokens = rm.slice(3, 3 + cols.length);
      // If we still don't have enough, pad from the front (skip actions if it looks like one)
      if (tokens.filter(Boolean).length < cols.length && rm.length >= cols.length) {
        const looksLikeActions =
          rm[0] && (rm[0].attempts >= 30 || (rm[1] && rm[0].attempts >= 2 * rm[1].attempts));
        const start = looksLikeActions ? 1 : 0;
        tokens = rm.slice(start, start + cols.length);
      }
    } else if (rm.length >= cols.length) {
      // If the list length equals the needed cols, the first token is often actions/successful.
      // Drop it when it looks too large to be shots.
      const looksLikeActions =
        rm.length === cols.length &&
        rm[0] &&
        (rm[0].attempts >= 30 || (rm[1] && rm[0].attempts >= 2 * rm[1].attempts));
      tokens = looksLikeActions ? rm.slice(1, cols.length + 1) : rm.slice(0, cols.length);
    } else if (rm.length >= 4) {
      // Pattern like: actions + passes + ... + duels + losses + recoveries
      const list = rm.slice(1); // drop actions
      const len = list.length;
      const duelsTok = list[len - 3];
      const lossTok = list[len - 2];
      const recTok = list[len - 1];
      const passTok = list[0];
      tokens = [
        null, // shots unknown
        passTok || null,
        null, // crosses/dribbles unknown
        null,
        duelsTok || null,
        lossTok || null,
        recTok || null
      ];
    }
  }

  cols.forEach((col, i) => {
    const tok = tokens[i];
    if (!tok) return;
    addStat(statsByPlayer, playerName, col, tok.attempts, tok.success);
  });

  const cardToken = ratios.slice(3 + cols.length).filter(Boolean).pop();
  if (cardToken) {
    addStat(statsByPlayer, playerName, "yellowCards", cardToken.attempts, null);
    if (cardToken.success != null) {
      addStat(statsByPlayer, playerName, "redCards", cardToken.success, null);
    }
  }
}

const HEADER_ANCHOR_REGEX = /Goals\s*\/\s*xG.*Assists\s*\/\s*xA/i;
const HEADER_SKIP_REGEX = /^(Player|Minutes|played|Goals|Assists|Actions|Shots|Passes|Crosses|Dribbles|Duels|Losses|Recoveries|Touches|Offsides|Yellow|Red)/i;
const CONTINUATION_REGEX = /(\d{1,3}\/\d{1,4}|%)/;

function findHeaderAnchors(lines) {
  const anchors = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HEADER_ANCHOR_REGEX.test(line)) {
      anchors.add(i);
      continue;
    }

    if (/Goals\s*\/\s*xG/i.test(line)) {
      const window = lines.slice(i, i + 4).join(" ");
      if (/Assists\s*\/\s*xA/i.test(window)) {
        anchors.add(i);
      }
    }
  }

  return Array.from(anchors).sort((a, b) => a - b);
}

function collectRowBlockBeforeHeader(lines, headerIndex, rowRegex) {
  const collected = [];
  let started = false;
  let rowCount = 0;

  for (let i = headerIndex - 1; i >= 0; i--) {
    const line = lines[i];
    const isRow = rowRegex.test(line);
    const isJersey = /^\d{1,3}$/.test(line);
    const isContinuation =
      started &&
      !isRow &&
      !isJersey &&
      CONTINUATION_REGEX.test(line) &&
      !HEADER_SKIP_REGEX.test(line);

    if (isRow || isJersey || isContinuation) {
      collected.push(line);
      if (isRow) rowCount += 1;
      started = true;
      continue;
    }

    if (started) break;
  }

  return { lines: collected.reverse(), rowCount };
}

function collectRowBlockAfterHeader(lines, headerIndex, rowRegex) {
  const collected = [];
  let started = false;
  let rowCount = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const isRow = rowRegex.test(line);
    const isJersey = /^\d{1,3}$/.test(line);
    const isContinuation =
      started &&
      !isRow &&
      !isJersey &&
      CONTINUATION_REGEX.test(line) &&
      !HEADER_SKIP_REGEX.test(line);

    if (isRow || isJersey || isContinuation) {
      collected.push(line);
      if (isRow) rowCount += 1;
      started = true;
      continue;
    }

    if (started) break;
  }

  return { lines: collected, rowCount };
}

function collectMainTableBlocks(lines, rowRegex) {
  const blocks = [];
  const anchorIndexes = findHeaderAnchors(lines);

  for (const idx of anchorIndexes) {
    const before = collectRowBlockBeforeHeader(lines, idx, rowRegex);
    if (before.rowCount) {
      blocks.push(before.lines);
      continue;
    }

    const after = collectRowBlockAfterHeader(lines, idx, rowRegex);
    if (after.rowCount) blocks.push(after.lines);
  }

  return blocks;
}

function extractPlayerStatsTable(
  blocks,
  nameByNorm,
  nameByNormWithNumber,
  resolveJerseyFromPlayers,
  normalizeName
) {
  const statsByPlayer = {};
  const dupCounter = {};
  const rowRegex = new RegExp(
    "^\\s*(\\d{1,3})?\\s*([A-Z]\\.\\s*\\p{Lu}[\\p{Ll}'\\-]+(?:\\s+\\p{Lu}[\\p{Ll}'\\-]+)*)\\s*(\\d{1,3})'?\\s*(.*)$",
    "u"
  );

  const parseLines = inputLines => {
    let currentName = null;
    let currentTail = "";

    const resetCurrent = () => {
      currentName = null;
      currentTail = "";
    };

    const flushCurrent = () => {
      if (!currentName || !currentTail) return;

      const ratios = parseRatioTail(currentTail);
      if (ratios.length) {
        applyTableRatios(statsByPlayer, currentName, ratios);
      }

      resetCurrent();
    };

    for (const line of inputLines) {
      if (HEADER_SKIP_REGEX.test(line)) {
        flushCurrent();
        continue;
      }

      const row = line.match(rowRegex);
      if (row) {
        flushCurrent();
        let jersey = row[1] ? row[1].trim() : null;
        const rawName = row[2];
        const norm = normalizeName(rawName);
        const canonical = resolveCanonical(norm, jersey, nameByNorm, nameByNormWithNumber);
        if (!canonical) {
          resetCurrent();
          continue;
        }
        const minutesTok = row[3] ? row[3].trim() : null;
        if (!jersey && typeof resolveJerseyFromPlayers === "function") {
          const resolved = resolveJerseyFromPlayers(canonical, minutesTok);
          if (resolved != null) jersey = String(resolved);
        }
        const baseKey = `${canonical}|m${minutesTok || "?"}${jersey ? `|#${jersey}` : ""}`;
        const count = dupCounter[baseKey] || 0;
        dupCounter[baseKey] = count + 1;
        const storeKey = count === 0 ? baseKey : `${baseKey}|dup${count}`;
        currentName = storeKey;
        currentTail = row[4] || "";
        continue;
      }

      if (currentName) {
        currentTail = (currentTail + " " + line).trim();
      }
    }

    flushCurrent();
  };

  for (const block of blocks) {
    parseLines(block);
  }

  return statsByPlayer;
}

export function extractFieldPlayerStats(
  text,
  { nameByNorm, nameByNormWithNumber, resolveJerseyFromPlayers, normalizeName }
) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const rowRegex = new RegExp(
    "^\\s*(\\d{1,3})?\\s*([A-Z]\\.\\s*\\p{Lu}[\\p{Ll}'\\-]+(?:\\s+\\p{Lu}[\\p{Ll}'\\-]+)*)\\s*(\\d{1,3})'?\\s*(.*)$",
    "u"
  );

  const blocks = collectMainTableBlocks(lines, rowRegex);
  if (!blocks.length) return {};

  return extractPlayerStatsTable(
    blocks,
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers,
    normalizeName
  );
}