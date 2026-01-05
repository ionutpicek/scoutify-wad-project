// src/matches/extractMinutes.js

function normalizeName(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchLength(text) {
  const regex = /\b(\d{1,2})(?:\+(\d{1,2}))?'/g;
  let maxMinute = 90;
  let match = null;

  while ((match = regex.exec(text)) !== null) {
    const base = Number(match[1]) || 0;
    const extra = Number(match[2]) || 0;
    const total = base + extra;
    if (total > maxMinute) maxMinute = total;
  }

  return maxMinute;
}

function extractMinutesFromPlayerStats(text) {
  const minutesByPlayer = {};
  const sectionRegex = /MATCH REPORT\s+PLAYER STATS/gi;
  const indices = [];
  let match = null;

  while ((match = sectionRegex.exec(text)) !== null) {
    indices.push(match.index);
  }

  if (!indices.length) return minutesByPlayer;

  const nameWord = "\\p{Lu}\\p{Ll}+(?:['-]\\p{Lu}?\\p{Ll}+)*";
  const nameToken = `([A-Z]\\.\\s*${nameWord}(?:\\s+${nameWord})*)`;
  const rowRegex = new RegExp(`\\b\\d{1,2}\\s+${nameToken}(\\d{1,3})'`, "gu");

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    const section = text.slice(start, end);

    rowRegex.lastIndex = 0;
    let row = null;
    while ((row = rowRegex.exec(section)) !== null) {
      const name = row[1];
      const minutes = Number(row[2]);
      if (!name || Number.isNaN(minutes)) continue;

      const key = normalizeName(name);
      if (!minutesByPlayer[key] || minutesByPlayer[key] < minutes) {
        minutesByPlayer[key] = minutes;
      }
    }
  }

  return minutesByPlayer;
}

export function extractPlayerMinutes(text, players = []) {
  const minutesByPlayer = {};
  let matchLength = findMatchLength(text);
  const statsMinutes = extractMinutesFromPlayerStats(text);

  const statsMax = Math.max(0, ...Object.values(statsMinutes));
  if (statsMax > matchLength) matchLength = statsMax;

  const subEntryMinutes = new Set();
  for (const p of players) {
    if (p.starter) continue;
    const hints = Array.isArray(p.minuteHints) ? p.minuteHints : [];
    if (!hints.length) continue;
    subEntryMinutes.add(Math.min(...hints));
  }

  for (const p of players) {
    const key = normalizeName(p.name);
    const keyWithNumber = `${key}#${p.number ?? ""}`;
    const hints = Array.isArray(p.minuteHints) ? p.minuteHints : [];

    let minutes = p.starter ? matchLength : 0;

    if (hints.length) {
      const minHint = Math.min(...hints);
      const maxHint = Math.max(...hints);

      if (p.starter) {
        minutes = subEntryMinutes.has(maxHint)
          ? Math.min(matchLength, maxHint)
          : matchLength;
      } else {
        minutes = Math.max(0, matchLength - minHint);
      }
    }

    if (statsMinutes[key] != null) {
      minutes = statsMinutes[key];
    }

    const payload = { totalMinutes: minutes };
    minutesByPlayer[key] = payload;
    minutesByPlayer[keyWithNumber] = payload;
  }

  return minutesByPlayer;
}
