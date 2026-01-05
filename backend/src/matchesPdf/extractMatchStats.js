// src/matches/extractMatchStats.js

const STAT_SECTIONS = {
  RECOVERIES: { key: "recoveries", mode: "ratio" },
  DRIBBLES: { key: "dribbles", mode: "ratio" },
  "KEY PASSES": { key: "keyPasses", mode: "ratio" },
  CROSSES: { key: "crosses", mode: "ratio" },
  FOULS: { key: "fouls", mode: "ratio" },
  "GROUND DUELS": { key: "groundDuels", mode: "ratio" },
  "AERIAL DUELS": { key: "aerialDuels", mode: "ratio" },
  SHOTS: { key: "shots", mode: "count" },
  PASSES: { key: "passes", mode: "ratio" },
  DUELS: { key: "duels", mode: "ratio" },
  LOSSES: { key: "lossesOwnHalf", mode: "ratio" },
  INTERCEPTIONS: { key: "interceptions", mode: "ratio" },
  CLEARANCES: { key: "clearances", mode: "ratio" }
};

function normalizeName(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveGkName(blockText, nameByNorm, players = []) {
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

function resolveCanonical(norm, jersey, nameByNorm, nameByNormWithNumber) {
  if (jersey && nameByNormWithNumber) {
    const hit = nameByNormWithNumber.get(`${norm}|${jersey}`);
    if (hit) return hit;
  }
  return nameByNorm?.get(norm);
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

function parseStatValue(value) {
  // Handles: "2", "2/1", "1/1100%", "2/150%"
  if (typeof value === "number") {
    return { attempts: value, success: null };
  }

  if (typeof value === "string" && value.includes("/")) {
    const parts = value.split("/");
    return parseRatioPair(parts[0], parts[1]);
  }

  return { attempts: 0, success: null };
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
  const tableKeys = new Set(["goals", "assists", "xG", "xA", ...cols]);
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

function parseCustomTable(
  lines,
  headerLabel,
  cols,
  nameByNorm,
  nameByNormWithNumber,
  resolveJerseyFromPlayers
) {
  const statsByPlayer = {};
  const dupCounter = {};
  const rowRegex = new RegExp(
    "^\\s*(?:[•●\\u25CF]\\s*)?(\\d{1,3})?\\s*([A-Z]\\.\\s*\\p{Lu}[\\p{Ll}'\\-]+(?:\\s+\\p{Lu}[\\p{Ll}'\\-]+)*)\\s*(\\d{1,3})'?\\s*(.*)$",
    "u"
  );

  const headerLower = headerLabel.toLowerCase();
  let headerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lower = line.toLowerCase();
    if (lower.includes(headerLower)) {
      headerSeen = true;
      continue;
    }

    if (!headerSeen) continue;

    const row = line.match(rowRegex);
    if (row) {
      let jersey = row[1] ? row[1].trim() : null;
      const minutesTok = row[3] ? row[3].trim() : null;
      const normName = normalizeName(row[2].trim());
      const canonical = resolveCanonical(normName, jersey, nameByNorm, nameByNormWithNumber);
      if (!canonical) continue;
      if (!jersey && typeof resolveJerseyFromPlayers === "function") {
        const resolved = resolveJerseyFromPlayers(canonical, minutesTok);
        if (resolved != null) jersey = String(resolved);
      }
      const playerName = canonical;
      const baseKey = `${canonical}|m${minutesTok || "?"}${jersey ? `|#${jersey}` : ""}`;
      const count = dupCounter[baseKey] || 0;
      dupCounter[baseKey] = count + 1;
      const storeKey = count === 0 ? baseKey : `${baseKey}|dup${count}`;

      // The table is split across multiple lines; gather subsequent lines until a blank or header-ish line
      let tailPieces = [row[4] || ""];
      let j = i + 1;
      while (j < lines.length) {
        const nxt = lines[j];
        if (!nxt || /^[A-Za-z ]+$/.test(nxt)) break;
        // stop if next line looks like a new player row (starts with number + name)
        if (/^\d{1,3}\s+[A-Z]\./.test(nxt)) break;
        tailPieces.push(nxt);
        j++;
      }
      i = j - 1; // advance outer loop

      const tailRaw = tailPieces.join(" ");
      const tailNoPct = tailRaw.replace(/%/g, " ");
      const tailPctFixed = tailNoPct.replace(/(\d{1,3}\/\d{1,3})(\d{2,3})(?!\d)/g, "$1 $2");
      const tailClean = tailPctFixed.replace(/(\d+\/\d{1,2})(\d{1,2}\/)/g, "$1 $2");
      const ratioMatchesClean = [...tailClean.matchAll(/(\d{1,3})\/(\d{1,3})/g)].map(m =>
        parseRatioPair(m[1], m[2], { forceCount: true })
      );
      // Some tables prepend actions/goals etc; try full parse, but also fallback by scanning tail for matches
      let ratios = parseRatioTail(tailClean, cols.length + 6);

      if (ratios.length < cols.length) {
        // Try to find ratios in the tail directly (split by spaces/dashes)
        const tokens = tailClean.split(/[-\s]+/).filter(Boolean);
        ratios = [];
        for (const tok of tokens) {
          const m = tok.match(/^(\d{1,3})\/(\d{1,4})(?:%?)$/);
          if (m) {
            ratios.push(parseRatioPair(m[1], m[2], { forceCount: true }));
          }
        }
      }

      // Fallback: if recoveries look wrong (e.g., huge number), use last N ratio tokens directly
      const ratioMatches = [...tailClean.matchAll(/(\d{1,3})\/(\d{1,3})/g)].map(m =>
        parseRatioPair(m[1], m[2], { forceCount: true })
      );
      if (ratioMatches.length >= cols.length) {
        const tailSlice = ratioMatches.slice(-cols.length);
        ratios = tailSlice;
      }

      // Special fallback for player stats table when we only have actions + a few ratios:
      // e.g., "--55/22 ... 32/15 ... 8/5 ... 19/14 9/1 ---"
      if (ratios.filter(Boolean).length === 0 && ratioMatches.length >= 2) {
        const seq = ratioMatches.slice(1); // drop actions
        const order = ["passes", "crosses", "dribbles", "duels", "losses", "recoveries"];
        ratios = order.map((_, idx) => seq[idx] || null);
      }

      // If still too short, pad with nulls to align
      while (ratios.length < cols.length) ratios.push(null);

      const tailEndRaw = tailRaw.match(/(\d{1,2})\/(\d{1,2})(\d{1,2})\/(\d{1,2})-+$/);
      if (tailEndRaw && statsByPlayer[storeKey]) {
        const lossTok = parseRatioPair(tailEndRaw[1], tailEndRaw[2], { forceCount: true });
        const recTok = parseRatioPair(tailEndRaw[3], tailEndRaw[4], { forceCount: true });
        const lossKey = cols[cols.length - 2];
        const recKey = cols[cols.length - 1];
        statsByPlayer[storeKey][lossKey] = { attempts: lossTok.attempts, success: lossTok.success };
        statsByPlayer[storeKey][recKey] = { attempts: recTok.attempts, success: recTok.success };
      }

      cols.forEach((colKey, idx) => {
        const tok = ratios[idx];
        if (!tok) return;
        if (!statsByPlayer[storeKey]) statsByPlayer[storeKey] = {};
        statsByPlayer[storeKey][colKey] = {
          attempts: tok.attempts,
          success: tok.success
        };
      });

      // Override losses/recoveries from the last two ratio matches if available
      const ratioMatches2 = ratioMatchesClean;
      if (ratioMatches2.length >= 2 && statsByPlayer[storeKey]) {
        const lossKey = cols[cols.length - 2];
        const recKey = cols[cols.length - 1];
        const hasLoss = !!statsByPlayer[storeKey][lossKey];
        const hasRec = !!statsByPlayer[storeKey][recKey];
        if (!hasLoss || !hasRec) {
          const lastTwo = ratioMatches2.slice(-2);
          const lossTok = lastTwo[0];
          const recTok = lastTwo[1];
          if (lossTok && !hasLoss) {
            statsByPlayer[storeKey][lossKey] = {
              attempts: lossTok.attempts,
              success: lossTok.success
            };
          }
          if (recTok && !hasRec) {
            statsByPlayer[storeKey][recKey] = {
              attempts: recTok.attempts,
              success: recTok.success
            };
          }
        }
      }

      // Final override: use trailing ratios (… a/b c/d ---) if present
      const tailEndMatch = tailClean.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2})\/(\d{1,2})-+$/);
      if (tailEndMatch && statsByPlayer[storeKey]) {
        const lossTok = parseRatioPair(tailEndMatch[1], tailEndMatch[2], { forceCount: true });
        const recTok = parseRatioPair(tailEndMatch[3], tailEndMatch[4], { forceCount: true });
        const lossKey = cols[cols.length - 2];
        const recKey = cols[cols.length - 1];
        if (!statsByPlayer[storeKey][lossKey]) {
          statsByPlayer[storeKey][lossKey] = {
            attempts: lossTok.attempts,
            success: lossTok.success
          };
        }
        if (!statsByPlayer[storeKey][recKey]) {
          statsByPlayer[storeKey][recKey] = {
            attempts: recTok.attempts,
            success: recTok.success
          };
        }
      }

      // Final sanity: if recoveries look too large, clamp to the last ratio with small numbers
      if (statsByPlayer[storeKey]) {
        const recKey = cols[cols.length - 1];
        const lossKey = cols[cols.length - 2];
        const smallTokens = ratioMatchesClean.filter(t => (t.attempts || 0) <= 30 && (t.success || 0) <= 30);
        if (smallTokens.length >= 1) {
          const recTok = smallTokens[smallTokens.length - 1];
          statsByPlayer[storeKey][recKey] = {
            attempts: recTok.attempts,
            success: recTok.success
          };
        }
        if (smallTokens.length >= 2) {
          const lossTok = smallTokens[smallTokens.length - 2];
          statsByPlayer[storeKey][lossKey] = {
            attempts: lossTok.attempts,
            success: lossTok.success
          };
        }
      }
      continue;
    }

    if (/^[A-Za-z ]+$/.test(line)) {
      // header-ish line; reset if we already captured something
      if (Object.keys(statsByPlayer).length) break;
      headerSeen = false;
    }
  }

  return statsByPlayer;
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

function extractGoalkeeperStats(text, nameByNorm, players = []) {
  const statsByPlayer = {};
  const lower = text.toLowerCase();
  let idx = lower.indexOf("goalkeeper in match");

  while (idx !== -1) {
    const block = text.slice(Math.max(0, idx - 400), idx + 500);
    const markerSlice = text.slice(idx, idx + 200);
    const canonical =
      resolveGkName(markerSlice, nameByNorm, players) ||
      resolveGkName(block, nameByNorm, players);

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

function extractGoalkeeperStatsLoose(text, players = []) {
  const statsByPlayer = {};
  const lower = text.toLowerCase();
  const normalize = normalizeName;

  let idx = lower.indexOf("goalkeeper in match");
  while (idx !== -1) {
    const block = text.slice(Math.max(0, idx - 400), idx + 500);
    const markerSlice = text.slice(idx, idx + 200);
    const canonical =
      resolveGkName(markerSlice, new Map(), players) ||
      resolveGkName(block, new Map(), players);

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

function extractPlayerStatsTable(text, nameByNorm, nameByNormWithNumber, resolveJerseyFromPlayers) {
  const statsByPlayer = {};
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const nameWord = "\\p{Lu}\\p{Ll}+(?:['-]\\p{Lu}?\\p{Ll}+)*";
  const rowRegex = new RegExp(
    "^\\s*(\\d{1,3})?\\s*([A-Z]\\.\\s*" +
      nameWord +
      "(?:\\s+" +
      nameWord +
      ")*)\\s*(\\d{1,3})'\\s*(.*)$",
    "u"
  );

  const teamStatsStart = lines.findIndex(
    (line, idx) =>
      /^TEAM STATS$/i.test(line) &&
      /^MATCH REPORT$/i.test(lines[idx - 1] || "")
  );
  let teamStatsEnd = -1;
  if (teamStatsStart !== -1) {
    for (let i = teamStatsStart + 1; i < lines.length; i++) {
      if (
        /^PLAYER STATS$/i.test(lines[i]) &&
        /^MATCH REPORT$/i.test(lines[i - 1] || "")
      ) {
        teamStatsEnd = i - 1;
        break;
      }
    }
  }

  const headerSkipRegex = /^(Player|Minutes|played|Goals|Assists|Actions|Shots|Passes|Crosses|Dribbles|Duels|Losses|Recoveries|Touches|Offsides|Yellow|Red)/i;
  const decimalRegex = /\d+\/\d+\.\d{1,2}/;

  const parseLines = (inputLines, { requireDecimal, onlyMissing }) => {
    const dupCounter = {};
    let currentName = null;
    let currentTail = "";

    const resetCurrent = () => {
      currentName = null;
      currentTail = "";
    };

    const flushCurrent = () => {
      if (!currentName || !currentTail) return;
      if (requireDecimal && !decimalRegex.test(currentTail)) {
        resetCurrent();
        return;
      }
      if (onlyMissing && statsByPlayer[currentName]) {
        resetCurrent();
        return;
      }

      const ratios = parseRatioTail(currentTail);
      if (ratios.length) {
        applyTableRatios(statsByPlayer, currentName, ratios);
      }

      resetCurrent();
    };

    for (const line of inputLines) {
      if (headerSkipRegex.test(line)) {
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

  parseLines(lines, { requireDecimal: false, onlyMissing: false });

  return statsByPlayer;
}

export function extractMatchStats(text, players = []) {
  const jerseyBuckets = new Map();
  const jerseyUsed = new Set();
  const jerseyByKey = new Map(); // `${canonical}|m${minutes}`

  players.forEach(p => {
    const name = p.name;
    if (!jerseyBuckets.has(name)) jerseyBuckets.set(name, []);
    jerseyBuckets.get(name).push({
      number: p.number,
      minutes: Number(p.minutesPlayed || 0),
      starter: Boolean(p.starter)
    });
  });

  for (const arr of jerseyBuckets.values()) {
    arr.sort((a, b) => {
      const s = Number(b.starter) - Number(a.starter);
      if (s !== 0) return s;
      const m = (b.minutes || 0) - (a.minutes || 0);
      if (m !== 0) return m;
      return (a.number || 0) - (b.number || 0);
    });
  }

  const resolveJerseyFromPlayers = (canonical, minutesTok) => {
    const key = `${canonical}|m${minutesTok || "?"}`;
    if (jerseyByKey.has(key)) return jerseyByKey.get(key);
    const bucket = jerseyBuckets.get(canonical);
    if (!bucket || !bucket.length) return null;
    const minutesNum = Number(minutesTok || 0);
    let pick = bucket.find(
      p => p.minutes === minutesNum && p.number != null && !jerseyUsed.has(`${canonical}|#${p.number}`)
    );
    if (!pick) {
      pick = bucket.find(p => p.number != null && !jerseyUsed.has(`${canonical}|#${p.number}`)) || bucket[0];
    }
    if (pick && pick.number != null) {
      jerseyUsed.add(`${canonical}|#${pick.number}`);
      jerseyByKey.set(key, pick.number);
      return pick.number;
    }
    return null;
  };

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

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

  const resolveCanonical = (norm, jersey) => {
    if (jersey) {
      const hit = nameByNormWithNumber.get(`${norm}|${jersey}`);
      if (hit) return hit;
    }
    return nameByNorm.get(norm);
  };

  let currentStat = null;

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];

    if (STAT_SECTIONS[line]) {
      currentStat = STAT_SECTIONS[line];
      continue;
    }

    if (currentStat) {
      const norm = normalizeName(line);
      const canonical = nameByNorm.get(norm);
      if (!canonical) continue;

      if (currentStat.mode === "count") {
        const existing = statsByPlayer[canonical]?.stats?.[currentStat.key];
        const currentCount = existing?.attempts || 0;
        addStat(statsByPlayer, canonical, currentStat.key, currentCount + 1, null);
        continue;
      }

      let rawValue = null;

      for (let j = i + 1; j < i + 6 && j < lines.length; j++) {
        if (/^\d+$/.test(lines[j]) || /^\d+\/\d+/.test(lines[j])) {
          rawValue = lines[j];
          break;
        }
      }

      if (!rawValue) continue;

      const parsed = parseStatValue(rawValue);
      addStat(statsByPlayer, canonical, currentStat.key, parsed.attempts, parsed.success);
    }
  }

  const tableStats = extractPlayerStatsTable(text, nameByNorm, nameByNormWithNumber, resolveJerseyFromPlayers);
  for (const [playerName, payload] of Object.entries(tableStats)) {
    if (!statsByPlayer[playerName]) statsByPlayer[playerName] = { stats: {} };
    Object.assign(statsByPlayer[playerName].stats, payload.stats);
  }

  // Additional tables (only key columns)
  const duelsCols = ["defensiveDuels", "offensiveDuels", "aerialDuels", "looseBallDuels"];
  const passingCols = [
    "forwardPasses",
    "backPasses",
    "lateralPasses",
    "shortMediumPasses",
    "longPasses",
    "progressivePasses",
    "finalThirdPasses"
  ];

  const duelsTable = parseCustomTable(
    lines,
    "Duels",
    duelsCols,
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers
  );
  const passingTable = parseCustomTable(
    lines,
    "Passing",
    passingCols,
    nameByNorm,
    nameByNormWithNumber,
    resolveJerseyFromPlayers
  );

  const mergeCustom = tableMap => {
    for (const [rawName, statObj] of Object.entries(tableMap)) {
      const storeKey = rawName; // rawName already includes jersey when present
      if (!storeKey) continue;
      if (!statsByPlayer[storeKey]) statsByPlayer[storeKey] = { stats: {} };
      for (const [statKey, val] of Object.entries(statObj)) {
        if (statKey === "_jersey") continue;
        addStat(statsByPlayer, storeKey, statKey, val.attempts, val.success);
      }
    }
  };

  mergeCustom(duelsTable);
  mergeCustom(passingTable);

  // Final override for losses/recoveries using raw player line (handles glued tokens like 19/149/1)
  players.forEach(p => {
    if (!p?.name) return;
    const line = lines.find(l => l.includes(p.name) && l.includes("/"));
    if (!line) return;

    // Keep success digits, drop only "%" and split glued ratios; use the last segment before trailing dashes
    const lineClean = line
      .replace(/%/g, " ")
      .replace(/(\d+\/\d{1,2})(\d{1,2}\/)/g, "$1 $2");

    const segments = lineClean.split("--").filter(Boolean);
    const target = [...segments].reverse().find(s => s.includes("/")) || lineClean;

    const ratios = [...target.matchAll(/(\d{1,3})\/(\d{1,4})/g)].map(m =>
      parseRatioPair(m[1], m[2], { forceCount: true })
    );
    if (ratios.length < 2) return;

    const lossTok = ratios[ratios.length - 2];
    const recTok = ratios[ratios.length - 1];

    if (!statsByPlayer[p.name]) statsByPlayer[p.name] = { stats: {} };
    const hasLoss = statsByPlayer[p.name].stats?.losses || statsByPlayer[p.name].stats?.lossesOwnHalf;
    const hasRec = statsByPlayer[p.name].stats?.recoveries;
    if (lossTok && !hasLoss) {
      addStat(statsByPlayer, p.name, "losses", lossTok.attempts, lossTok.success);
    }
    if (recTok && !hasRec) {
      addStat(statsByPlayer, p.name, "recoveries", recTok.attempts, recTok.success);
    }
  });

  // Goalkeeper-specific stats (saves, shotsAgainst, concededGoals, reflexSaves, exits)
  const gkStats = extractGoalkeeperStats(text, nameByNorm, players);
  const gkStatsLoose = extractGoalkeeperStatsLoose(text, players);
  const mergedGk = { ...gkStats, ...gkStatsLoose };

  for (const [playerName, payload] of Object.entries(mergedGk)) {
    if (!statsByPlayer[playerName]) statsByPlayer[playerName] = { stats: {} };
    Object.assign(statsByPlayer[playerName].stats, payload.stats);
  }

  // Force-add GK stats from blocks by last name, regardless of previous merges
  if (players?.length) {
    const lower = text.toLowerCase();
    let idx = lower.indexOf("goalkeeper in match");
    while (idx !== -1) {
      const block = text.slice(Math.max(0, idx - 400), idx + 500);
      const markerSlice = text.slice(idx, idx + 200);
      const playerName =
        resolveGkName(markerSlice, new Map(), players) ||
        resolveGkName(block, new Map(), players);
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
