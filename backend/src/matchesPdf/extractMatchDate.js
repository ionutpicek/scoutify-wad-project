// src/matches/extractMatchDate.js
export function extractMatchDate(text) {
  const match = text.match(/\((\d{2}\.\d{2}\.\d{4})\)/);
  if (!match) return null;

  const [day, month, year] = match[1].split(".");
  return `${year}-${month}-${day}`; // ISO
}
