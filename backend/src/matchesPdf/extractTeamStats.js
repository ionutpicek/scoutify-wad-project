// Lightweight extractor for the TEAM STATS page (home vs away aggregates).
// We keep it contained here to avoid bloating extractMatchStats.

function findLine(lines, needle) {
  const n = needle.toLowerCase().replace(/\s+/g, "");
  return (
    lines.find(l => {
      const compact = l.toLowerCase().replace(/\s+/g, "");
      return compact.includes(n) && /\d/.test(l);
    }) || ""
  );
}

function numbersFromLine(line) {
  if (!line) return [];
  // Insert a space between back-to-back numbers like "57%43" or "1.662.79"
  const spaced = line.replace(/(\d\.\d{1,2})(?=\d)/g, "$1 ").replace(/(\d)(?=\d{2}%)/g, "$1 ");
  return [...spaced.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
}

function fuseToPair(num) {
  const s = String(num);
  if (s.length === 1) return [num, null];
  const mid = Math.floor(s.length / 2);
  return [Number(s.slice(0, mid)), Number(s.slice(mid))];
}

function pickPair(nums) {
  if (nums.length >= 2) {
    const a = nums[0];
    const b = nums[1];
    // If the second number looks fused (e.g., 1414), split it.
    const [b1, b2] = b != null && b > 999 ? fuseToPair(b) : [b, null];
    return [a, b1 != null ? b1 : b];
  }
  if (nums.length === 1) {
    return fuseToPair(nums[0]);
  }
  return [null, null];
}

function parseRatioPair(line) {
  // e.g., "Shots / on target 22/6 17/6" or "Shots / on target22/617/6"
  if (!line) return { home: [null, null], away: [null, null] };
  // Remove glued trailing percentages after ratios, e.g., "281/17663%" -> "281/176 "
  let cleaned = line.replace(/(\d+\/\d+?)(\d{2})%/g, "$1 ");
  cleaned = cleaned.replace(/%/g, " ");
  const matches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)[/](\d+(?:\.\d+)?)/g)];
  if (matches.length >= 2) {
    const home = [Number(matches[0][1]), Number(matches[0][2])];
    const away = [Number(matches[1][1]), Number(matches[1][2])];
    return { home, away };
  }
  // Fallback: infer from raw numbers when ratios are glued (e.g., "17/78/2")
  const nums = numbersFromLine(line);
  if (nums.length >= 3) {
    const [a, b] = fuseToPair(nums[1]);
    const home = [nums[0], a];
    const away = [b, nums[2]];
    return { home, away };
  }
  return { home: [null, null], away: [null, null] };
}

function parseTimePair(line) {
  if (!line) return { home: null, away: null };
  const matches = [...line.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (matches.length >= 2) {
    const toSec = m => Number(m[1]) * 60 + Number(m[2]);
    return { home: toSec(matches[0]), away: toSec(matches[1]) };
  }
  return { home: null, away: null };
}

export function extractTeamStats(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const stats = { home: {}, away: {} };

  // xG
  {
    const line =
      lines.find(l => l.toLowerCase().startsWith("xg") && /\d/.test(l)) ||
      findLine(lines, "xg");
    const nums = numbersFromLine(line).filter(n => n >= 0 && n < 20);
    const [h, a] =
      nums.length >= 2
        ? [nums[0], nums[1]]
        : nums.length
          ? pickPair(nums)
          : [null, null];
    if (h != null) stats.home.xG = h;
    if (a != null) stats.away.xG = a;
  }

  // Possession %
  {
    const line = findLine(lines, "possession %");
    const nums = numbersFromLine(line);
    const [h, a] = pickPair(nums.length >= 2 ? nums.slice(-2) : nums);
    if (h != null) stats.home.possessionPct = h;
    if (a != null) stats.away.possessionPct = a;
  }

  // Shots / on target
  const shotsLine = findLine(lines, "shots / on target");
  if (shotsLine) {
    const { home, away } = parseRatioPair(shotsLine);
    const [shH, sotH] = home;
    const [shA, sotA] = away;
    if (shH != null) stats.home.shots = shH;
    if (sotH != null) stats.home.shotsOnTarget = sotH;
    if (shA != null) stats.away.shots = shA;
    if (sotA != null) stats.away.shotsOnTarget = sotA;
  }

  // Corners
  {
    const line = findLine(lines, "corners");
    const nums = numbersFromLine(line);
    const [h, a] = pickPair(nums.length >= 2 ? nums.slice(-2) : nums);
    if (h != null) stats.home.corners = h;
    if (a != null) stats.away.corners = a;
  }

  // Fouls
  {
    const line = findLine(lines, "fouls");
    const { home, away } = parseRatioPair(line); // fouls / suffered
    const [fH] = home;
    const [fA] = away;
    if (fH != null) stats.home.fouls = fH;
    if (fA != null) stats.away.fouls = fA;
  }

  // Yellow / red cards
  const cardsLine = findLine(lines, "yellow / red cards");
  const cardNums = numbersFromLine(cardsLine);
  if (cardNums.length >= 4) {
    stats.home.yellow = cardNums[0];
    stats.home.red = cardNums[1];
    stats.away.yellow = cardNums[2];
    stats.away.red = cardNums[3];
  }

  // Passes total / accurate
  {
    const line = findLine(lines, "total passes / accurate");
    if (line) {
      const { home, away } = parseRatioPair(line);
      const [pH, paH] = home;
      const [pA, paA] = away;
      if (pH != null) stats.home.passes = pH;
      if (paH != null) stats.home.passesAccurate = paH;
      if (pA != null) stats.away.passes = pA;
      if (paA != null) stats.away.passesAccurate = paA;
    }
  }

  // Long pass share %
  {
    const line = findLine(lines, "long pass share");
    const nums = numbersFromLine(line);
    const [h, a] = pickPair(nums.length >= 2 ? nums.slice(-2) : nums);
    if (h != null) stats.home.longPassSharePct = h;
    if (a != null) stats.away.longPassSharePct = a;
  }

  // Duels (total / won)
  const duelsLine = findLine(lines, "total duels / won");
  if (duelsLine) {
    const { home, away } = parseRatioPair(duelsLine);
    const [dH, dwH] = home;
    const [dA, dwA] = away;
    if (dH != null) {
      stats.home.duels = dH;
      stats.home.duelsWon = dwH;
    }
    if (dA != null) {
      stats.away.duels = dA;
      stats.away.duelsWon = dwA;
    }
  }

  // PPDA
  {
    const line = findLine(lines, "ppda");
    const nums = numbersFromLine(line);
    const [h, a] = nums.length >= 2 ? [nums[0], nums[1]] : pickPair(nums);
    if (h != null) stats.home.ppda = h;
    if (a != null) stats.away.ppda = a;
  }

  // Pure possession time (mm:ss)
  {
    const line = findLine(lines, "pure possession time");
    const { home, away } = parseTimePair(line);
    if (home != null) stats.home.purePossessionSec = home;
    if (away != null) stats.away.purePossessionSec = away;
  }

  // Average possession duration (mm:ss)
  {
    const line = findLine(lines, "average possession duration");
    const { home, away } = parseTimePair(line);
    if (home != null) stats.home.avgPossessionDurationSec = home;
    if (away != null) stats.away.avgPossessionDurationSec = away;
  }

  // Dead time (mm:ss)
  {
    const line = findLine(lines, "dead time");
    const { home, away } = parseTimePair(line);
    if (home != null) stats.home.deadTimeSec = home;
    if (away != null) stats.away.deadTimeSec = away;
  }

  // Recoveries (opponent half recoveries line has three numbers; take first pair)
  {
    const recLine = findLine(lines, "recoveries");
    const block = recLine.match(/(\d+\/\d+\/\d+\/\d+)\s+(\d+\/\d+\/\d+\/\d+)/);
    const recNumsRaw = numbersFromLine(recLine);

    if (block) {
      const homeTot = Number(block[1].split("/")[0]);
      const awayTot = Number(block[2].split("/")[0]);
      stats.home.recoveries = homeTot;
      stats.away.recoveries = awayTot;
    } else if (recNumsRaw.length) {
      let recNums = [...recNumsRaw];
      // If a fused token (e.g., 2589) is present in the middle, split it.
      const midIdx = Math.floor(recNums.length / 2);
      if (recNums[midIdx] > 999) {
        const [a, b] = fuseToPair(recNums[midIdx]);
        recNums = [...recNums.slice(0, midIdx), a, b, ...recNums.slice(midIdx + 1)];
      }

      if (recNums.length >= 8) {
        // Pattern: total/low/med/high total/low/med/high
        const stride = recNums.length / 2;
        stats.home.recoveries = recNums[0];
        stats.away.recoveries = recNums[stride];
      } else if (recNums.length >= 2) {
        stats.home.recoveries = recNums[0];
        stats.away.recoveries = recNums[1];
      }
    }
  }

  // Opponent half recoveries
  const oppRecLine = findLine(lines, "opponent half recoveries");
  const oppRecNums = numbersFromLine(oppRecLine);
  if (oppRecNums.length >= 2) {
    stats.home.opponentHalfRecoveries = oppRecNums[0];
    stats.away.opponentHalfRecoveries = oppRecNums[1];
  }

  // Shots from corners/free kicks (optional)
  const attacksLine = findLine(lines, "total with shots");
  const [attH, attA] = pickPair(numbersFromLine(attacksLine));
  if (attH != null) stats.home.attacks = attH;
  if (attA != null) stats.away.attacks = attA;

  return stats;
}
