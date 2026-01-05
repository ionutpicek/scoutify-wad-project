// src/matches/normalizeText.js
export function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}
