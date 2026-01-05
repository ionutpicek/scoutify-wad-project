function normalizeName(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_WORD = "\\p{Lu}\\p{Ll}+(?:['-]\\p{Lu}?\\p{Ll}+)*";

export function extractPlayerPositions(text) {
  const positionHits = {};
  const positionToken =
    "(GK|CB|RCB|LCB|RB|LB|WB|RWB|LWB|DM|DMF|CM|AM|AMF|RDMF|LDMF|RCMF|LCMF|RAMF|LAMF|RW|LW|RWF|LWF|W|FW|ST|CF)";
  const nameToken = `([A-Z]\\.\\s*${NAME_WORD}(?:\\s+${NAME_WORD})*)`;
  const regex = new RegExp(`\\b${positionToken}\\b\\s+\\d{1,3}\\s+${nameToken}`, "gu");

  let match = null;
  while ((match = regex.exec(text)) !== null) {
    const pos = match[1].toUpperCase();
    const rawName = match[2];
    const key = normalizeName(rawName);

    if (!positionHits[key]) positionHits[key] = {};
    positionHits[key][pos] = (positionHits[key][pos] || 0) + 1;
  }

  const positionsByPlayer = {};
  for (const [name, counts] of Object.entries(positionHits)) {
    let bestPos = null;
    let bestCount = -1;

    for (const [pos, c] of Object.entries(counts)) {
      if (c > bestCount) {
        bestPos = pos;
        bestCount = c;
      }
    }

    positionsByPlayer[name] = bestPos;
  }

  return positionsByPlayer;
}
