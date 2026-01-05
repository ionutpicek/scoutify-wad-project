// src/matches/extractPlayers.js

const NAME_WORD = "\\p{Lu}\\p{Ll}+(?:['-]\\p{Lu}?\\p{Ll}+)*";
const NAME_PATTERN = new RegExp(`([A-Z]\\.\\s*${NAME_WORD}(?:\\s+${NAME_WORD})*)`, "u");

const POSITION_TOKEN =
  "(GK|CB|RCB|LCB|RB|LB|WB|RWB|LWB|DM|DMF|CM|AM|AMF|RDMF|LDMF|RCMF|LCMF|RAMF|LAMF|RW|LW|RWF|LWF|W|FW|ST|CF)";

function normalizeName(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMinuteTokens(text) {
  const minutes = [];
  if (!text) return minutes;

  const regex = /(\d{1,2})(?:\+(\d{1,2}))?'/g;
  let match = null;
  while ((match = regex.exec(text)) !== null) {
    const base = Number(match[1]) || 0;
    const extra = Number(match[2]) || 0;
    minutes.push(base + extra);
  }

  return minutes;
}

function extractLineupSegment(text) {
  const start = text.search(/starting lineup/i);
  if (start === -1) return null;

  const end = text.search(/match report match sheet|match report\b/i);
  if (end !== -1 && end > start) {
    return text.slice(start, end);
  }

  return text.slice(start);
}

function extractLineupEntries(text) {
  const nameToken = `([A-Z]\\.\\s*${NAME_WORD}(?:\\s+${NAME_WORD})*)`;
  const regex = new RegExp(
    `\\b${POSITION_TOKEN}\\b\\s+(\\d{1,3})\\s+${nameToken}((?:\\s*\\d{1,2}(?:\\+\\d{1,2})?'\\s*)*)`,
    "gu"
  );

  const entries = [];
  let match = null;
  while ((match = regex.exec(text)) !== null) {
    const number = Number(match[2]) || null;
    const name = match[3];
    if (!name) continue;

    entries.push({
      name: name.trim(),
      number,
      position: match[1],
      minuteHints: parseMinuteTokens(match[4])
    });
  }

  return entries;
}

function extractSubstituteEntries(text) {
  const start = text.search(/substitutes/i);
  if (start === -1) return [];

  const markers = [
    /bench/i,
    /coaches/i,
    /match report match sheet/i,
    /match report\b/i
  ];

  const ends = markers
    .map(re => {
      const idx = text.slice(start).search(re);
      return idx === -1 ? -1 : start + idx;
    })
    .filter(idx => idx !== -1);

  const end = ends.length ? Math.min(...ends) : text.length;
  const subsText = text.slice(start, end);

  const nameToken = `([A-Z]\\.\\s*${NAME_WORD}(?:\\s+${NAME_WORD})*)`;
  const regex = new RegExp(
    `\\b${POSITION_TOKEN}\\b\\s+(\\d{1,3})\\s+${nameToken}((?:\\s*\\d{1,2}(?:\\+\\d{1,2})?'\\s*)*)`,
    "gu"
  );

  const subs = [];
  let match = null;
  while ((match = regex.exec(subsText)) !== null) {
    const number = Number(match[2]) || null;
    const name = match[3];
    if (!name) continue;
    subs.push({
      name: name.trim(),
      number,
      position: match[1],
      minuteHints: parseMinuteTokens(match[4]),
      starter: false
    });
  }

  return subs;
}

function extractBenchEntries(text) {
  const benchStart = text.search(/bench/i);
  if (benchStart === -1) return [];

  const benchEnd = text.search(/coaches|match report\b/i);
  const benchText =
    benchEnd !== -1 && benchEnd > benchStart
      ? text.slice(benchStart, benchEnd)
      : text.slice(benchStart);

  const nameToken = `([A-Z]\\.\\s*${NAME_WORD}(?:\\s+${NAME_WORD})*)`;
  const regex = new RegExp(`\\b(\\d{1,3})\\s+${nameToken}`, "gu");

  const bench = [];
  let match = null;
  while ((match = regex.exec(benchText)) !== null) {
    const number = Number(match[1]) || null;
    const name = match[2];
    if (!name) continue;
    bench.push({ name: name.trim(), number });
  }

  return bench;
}

export function extractPlayers(text) {
  const segment = extractLineupSegment(text) || text;

  const lineup = extractLineupEntries(segment);
  const substitutes = extractSubstituteEntries(text);
  let bench = extractBenchEntries(segment);

  // Some PDFs place the word "Bench" near the top, causing the bench parser to
  // greedily scoop up the whole lineup. If the bench list is abnormally large
  // (as large as or larger than the lineup itself), treat it as noise.
  if (bench.length && bench.length >= lineup.length) {
    bench = [];
  }
  const benchKeys = new Set(
    bench.map(b => `${normalizeName(b.name)}#${b.number ?? ""}`)
  );

  // The PDF lists both teams' lineups consecutively; allow up to 22 starters before substitutes.
  const startersCount = Math.min(22, lineup.length);
  const players = lineup.map((p, idx) => ({
    name: p.name,
    number: p.number,
    position: p.position,
    starter: idx < startersCount,
    minuteHints: p.minuteHints
  }));

  for (const sub of substitutes) {
    players.push({
      name: sub.name,
      number: sub.number,
      position: sub.position,
      starter: false,
      minuteHints: sub.minuteHints
    });
  }

  // demote any player that appears in the bench list
  for (const p of players) {
    const key = `${normalizeName(p.name)}#${p.number ?? ""}`;
    if (benchKeys.has(key)) {
      p.starter = false;
    }

    // If a "starter" only shows a single early minute (likely the entry time), treat as a sub.
    if (
      p.starter &&
      Array.isArray(p.minuteHints) &&
      p.minuteHints.length === 1 &&
      Math.min(...p.minuteHints) <= 30
    ) {
      p.starter = false;
    }
  }

  const seen = new Set(
    players.map(p => `${normalizeName(p.name)}#${p.number ?? ""}`)
  );
  for (const b of bench) {
    const key = `${normalizeName(b.name)}#${b.number ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({
      name: b.name,
      number: b.number,
      position: null,
      starter: false,
      minuteHints: []
    });
  }

  return players;
}
