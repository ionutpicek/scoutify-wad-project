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

