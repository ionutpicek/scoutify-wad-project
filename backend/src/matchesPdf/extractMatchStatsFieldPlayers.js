// src/matches/extractMatchStatsFieldPlayers.js

function resolveCanonical(norm, jersey, nameByNorm, nameByNormWithNumber) {
  if (jersey && nameByNormWithNumber) {
    const hit = nameByNormWithNumber.get(`${norm}|${jersey}`);
    if (hit) return hit;
  }
  return nameByNorm?.get(norm);
}

const ROW_REGEX = new RegExp(
  "^\\s*(\\d{1,3})?\\s*([A-Z]\\.\\s*\\p{Lu}[\\p{Ll}'\\-]+(?:\\s+\\p{Lu}[\\p{Ll}'\\-]+)*)\\s*(\\d{1,3})'?\\s*(.*)$",
  "u"
);

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

function parsePassingTail(tail) {
  const normalized = String(tail || "")
    .replace(/(\d{1,3}\/\d{1,3})(\d{2,3}\.\d)/g, "$1 $2");
  const ratioMatches = [...normalized.matchAll(/\d{1,3}\/\d{1,4}(?:\.\d{1,2})?%?/g)];
  const ratioCount = Math.min(ratioMatches.length, 8);
  const ratios = ratioMatches.slice(0, 8).map(match => {
    const parts = match[0].split("/");
    return parseRatioPair(parts[0], parts[1], { forceCount: true });
  });

  while (ratios.length < 8) ratios.push(null);

  const countsRaw = normalized
    .replace(/\d{1,3}\/\d{1,4}(?:\.\d{1,2})?%?/g, " ")
    .replace(/%/g, " ")
    .replace(/-/g, " - ");
  const counts = [];
  const tokens = countsRaw.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === "-") {
      counts.push(null);
      continue;
    }
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      counts.push(Number(tok));
    }
  }

  for (let i = counts.length - 1; i >= 0; i -= 1) {
    if (counts[i] == null) continue;
    counts.splice(i, 1);
    break;
  }

  let missingRatios = 8 - ratioCount;
  while (missingRatios > 0 && counts.length && counts[0] == null) {
    counts.shift();
    missingRatios -= 1;
  }

  while (counts.length < 4) counts.push(null);
  return { ratios, counts: counts.slice(0, 4) };
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

function applyDuelsRatios(statsByPlayer, playerName, ratios) {
  const defensiveTok = ratios?.[0] || null;
  const offensiveTok = ratios?.[1] || null;

  if (defensiveTok) {
    const prev = statsByPlayer[playerName]?.stats?.defensiveDuels?.attempts ?? -1;
    if (defensiveTok.attempts >= prev) {
      addStat(statsByPlayer, playerName, "defensiveDuels", defensiveTok.attempts, defensiveTok.success);
    }
  }

  if (offensiveTok) {
    const prev = statsByPlayer[playerName]?.stats?.offensiveDuels?.attempts ?? -1;
    if (offensiveTok.attempts >= prev) {
      addStat(statsByPlayer, playerName, "offensiveDuels", offensiveTok.attempts, offensiveTok.success);
    }
  }
}

function applyPassingRatios(statsByPlayer, playerName, ratios, counts) {
  const forwardTok = ratios?.[0] || null;
  const progressiveTok = ratios?.[5] || null;
  const finalThirdTok = ratios?.[6] || null;
  const throughTok = ratios?.[7] || null;

  if (forwardTok) {
    const prev = statsByPlayer[playerName]?.stats?.forwardPasses?.attempts ?? -1;
    if (forwardTok.attempts >= prev) {
      addStat(statsByPlayer, playerName, "forwardPasses", forwardTok.attempts, forwardTok.success);
    }
  }

  if (progressiveTok) {
    const prev = statsByPlayer[playerName]?.stats?.progressivePasses?.attempts ?? -1;
    if (progressiveTok.attempts >= prev) {
      addStat(statsByPlayer, playerName, "progressivePasses", progressiveTok.attempts, progressiveTok.success);
    }
  }

  if (finalThirdTok) {
    const prev = statsByPlayer[playerName]?.stats?.passesFinalThird?.attempts ?? -1;
    if (finalThirdTok.attempts >= prev) {
      addStat(statsByPlayer, playerName, "passesFinalThird", finalThirdTok.attempts, finalThirdTok.success);
    }
  }

  if (throughTok) {
    const prev = statsByPlayer[playerName]?.stats?.throughPasses?.attempts ?? -1;
    if (throughTok.attempts >= prev) {
      addStat(statsByPlayer, playerName, "throughPasses", throughTok.attempts, throughTok.success);
    }
  }

  const keyPassCandidate = counts?.[1];
  const keyPasses = Number.isFinite(keyPassCandidate) && Number.isInteger(keyPassCandidate)
    ? keyPassCandidate
    : null;

  if (keyPasses != null) {
    const prev = statsByPlayer[playerName]?.stats?.keyPasses?.attempts ?? -1;
    if (keyPasses >= prev) {
      addStat(statsByPlayer, playerName, "keyPasses", keyPasses, null);
    }
  }
}

const HEADER_ANCHOR_REGEX = /Goals\s*\/\s*xG.*Assists\s*\/\s*xA/i;
const HEADER_SKIP_REGEX = /^(Player|Minutes|played|Goals|Assists|Actions|Shots|Passes|Crosses|Dribbles|Duels|Losses|Recoveries|Touches|Offsides|Yellow|Red)/i;
const CONTINUATION_REGEX = /(\d{1,3}\/\d{1,4}|%)/;
const DUELS_HEADER_REGEXES = [/Defensive duels/i, /Offensive duels/i];
const PASSING_TITLE_REGEX = /^Passing$/i;
const DUELS_HEADER_SKIP_REGEX = /^(Player|Minutes|played|Defensive|Offensive|Aerial|Loose|Shots|Interceptions|Clearances|Sliding|Fouls|Free|Set pieces|Direct|Corners|served|Throw-ins)/i;
const PASSING_HEADER_SKIP_REGEX = /^(Player|Minutes|played|Forward|Back|Lateral|Short|Long|Progressive|Passes|Through|Deep|Key|Second|Shot|Average)/i;

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

function findSectionAnchors(lines, regexes, lookahead = 10) {
  const anchors = new Set();
  for (let i = 0; i < lines.length; i++) {
    const window = lines.slice(i, i + lookahead).join(" ");
    if (regexes.every(re => re.test(window))) {
      anchors.add(i);
    }
  }
  return Array.from(anchors).sort((a, b) => a - b);
}

function findPassingAnchors(lines) {
  const anchors = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (PASSING_TITLE_REGEX.test(lines[i])) {
      anchors.add(i);
    }
  }
  return Array.from(anchors).sort((a, b) => a - b);
}

function collectSectionBlocks(lines, rowRegex, regexes, prefer = "after") {
  const blocks = [];
  const anchors = findSectionAnchors(lines, regexes);

  for (const idx of anchors) {
    const before = collectRowBlockBeforeHeader(lines, idx, rowRegex);
    const after = collectRowBlockAfterHeader(lines, idx, rowRegex);
    let pick = prefer === "before" ? before : after;
    if (!pick.rowCount) {
      pick = prefer === "before" ? after : before;
    }
    if (pick.rowCount) blocks.push(pick.lines);
  }

  return blocks;
}

function collectPassingBlocks(lines, rowRegex) {
  const blocks = [];
  const anchors = findPassingAnchors(lines);

  for (const idx of anchors) {
    const after = collectRowBlockAfterHeader(lines, idx, rowRegex);
    if (after.rowCount) blocks.push(after.lines);
  }

  return blocks;
}

function applyTableBlocks(
  blocks,
  statsByPlayer,
  {
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers,
    normalizeName,
    headerSkipRegex,
    onRow
  }
) {
  if (!blocks.length) return;
  const dupCounter = {};

  const parseLines = inputLines => {
    let currentName = null;
    let currentTail = "";
    let pendingJersey = null;

    const resetCurrent = () => {
      currentName = null;
      currentTail = "";
    };

    const flushCurrent = () => {
      if (!currentName || !currentTail) return;
      onRow(currentName, currentTail);
      resetCurrent();
    };

    for (const line of inputLines) {
      if (headerSkipRegex?.test(line)) {
        flushCurrent();
        continue;
      }

      if (/^\d{1,3}$/.test(line)) {
        flushCurrent();
        pendingJersey = line.trim();
        continue;
      }

      const row = line.match(ROW_REGEX);
      if (row) {
        flushCurrent();
        let jersey = row[1] ? row[1].trim() : pendingJersey;
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
        pendingJersey = null;
        const baseKey = `${canonical}|m${minutesTok || "?"}${jersey ? `|#${jersey}` : ""}`;
        let storeKey = baseKey;
        if (!statsByPlayer[baseKey]) {
          const count = dupCounter[baseKey] || 0;
          dupCounter[baseKey] = count + 1;
          storeKey = count === 0 ? baseKey : `${baseKey}|dup${count}`;
        }
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

      const row = line.match(ROW_REGEX);
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

  const blocks = collectMainTableBlocks(lines, ROW_REGEX);
  if (!blocks.length) return {};

  const statsByPlayer = extractPlayerStatsTable(
    blocks,
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers,
    normalizeName
  );

  const duelsBlocks = collectSectionBlocks(lines, ROW_REGEX, DUELS_HEADER_REGEXES, "before");
  applyTableBlocks(duelsBlocks, statsByPlayer, {
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers,
    normalizeName,
    headerSkipRegex: DUELS_HEADER_SKIP_REGEX,
    onRow: (playerKey, tail) => {
      const ratios = parseRatioTail(tail, 2);
      applyDuelsRatios(statsByPlayer, playerKey, ratios);
    }
  });

  const passingBlocks = collectPassingBlocks(lines, ROW_REGEX);
  applyTableBlocks(passingBlocks, statsByPlayer, {
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers,
    normalizeName,
    headerSkipRegex: PASSING_HEADER_SKIP_REGEX,
    onRow: (playerKey, tail) => {
      const parsed = parsePassingTail(tail);
      applyPassingRatios(statsByPlayer, playerKey, parsed.ratios, parsed.counts);
    }
  });

  return statsByPlayer;
}
