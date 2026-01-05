// src/utils/normalizeText.js
export function fixMojibake(s) {
  if (!/[ÃÄÅÈâ]/.test(s)) return s;
  return Buffer.from(s, "latin1").toString("utf8");
}

export function normalizeTeamName(str) {
  return fixMojibake(String(str || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
