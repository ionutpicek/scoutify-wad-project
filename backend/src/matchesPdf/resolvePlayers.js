import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const shouldUseMysql = () => isMysqlConfigured();

const parseSourcePayload = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

/* ---------------- NORMALIZATION ---------------- */

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPdfName(pdfName) {
  const norm = normalize(pdfName);
  const [initialPart, ...rest] = norm.split(" ");
  return {
    initial: initialPart?.replace(".", "") || null,
    surname: rest.join(" ")
  };
}

const ALIASES = {
  "b lenovan": "b ienovan",
  "lenovan": "ienovan",
  "b bucsa": "a bucsa", // force both Bucsa sisters through the same special handler
  "a bucsa": "a bucsa" // keep canonical token
};

const CANONICAL_OVERRIDE = {
  "b lenovan": "Bianca Ienovan",
  "lenovan": "Bianca Ienovan"
};

const BUCSSA_NUMBERS = {
  aida: 8,
  ariana: 11
};

function applyAliases(norm) {
  return ALIASES[norm] || norm;
}

/* ---------------- FIRESTORE LOAD ---------------- */

async function loadAllPlayers() {
  if (!shouldUseMysql()) {
    throw new Error("MySQL not configured for player resolution.");
  }

  const mysql = getMysqlPool();
  const [rows] = await mysql.query(
    `SELECT id, player_id, team_id, name, abbr_name, source_payload
     FROM players`
  );

  return rows.map(row => {
    const payload = parseSourcePayload(row.source_payload);
    const name = row.name ?? payload.name ?? "";
    const abbrName = row.abbr_name ?? payload.abbrName ?? "";
    return {
      id: row.id,
      playerID: row.player_id ?? payload.playerID ?? null,
      teamID: row.team_id ?? payload.teamID ?? null,
      name,
      abbrName,
      shirtNumber: payload.shirtNumber ?? payload.number ?? null,
      number: payload.number ?? null,
      _normName: normalize(name),
      _normAbbr: normalize(abbrName)
    };
  });
}

function pickCandidate(candidates, homeTeamId, awayTeamId) {
  if (!candidates.length) return null;
  const prioritized = candidates.filter(
    c =>
      c.teamID == homeTeamId ||
      c.teamID == awayTeamId ||
      c.teamId == homeTeamId ||
      c.teamId == awayTeamId
  );
  return prioritized[0] || candidates[0] || null;
}

/* ---------------- RESOLVER ---------------- */

export async function resolvePlayers(parsedPlayers, meta = {}) {
  const homeTeamId = meta.homeTeamId || meta.hometeamID;
  const awayTeamId = meta.awayTeamId || meta.awayteamID;
  const allPlayers = await loadAllPlayers();
  const resolved = [];

  for (const p of parsedPlayers) {
    let match = null;
    let normPdf = applyAliases(normalize(p.name));

  // --- Bucsa sisters special handling ---
    if (normPdf === "a bucsa") {
      const bucsaCandidates = allPlayers.filter(pl =>
        pl._normName.endsWith("bucsa")
      );
      const aida = bucsaCandidates.find(pl => pl._normName.startsWith("aida "));
      const ariana = bucsaCandidates.find(pl =>
        pl._normName.startsWith("ariana ")
      );

      const preferForNumber = num =>
        pickCandidate(
          bucsaCandidates.filter(pl => pl.shirtNumber == num || pl.number == num),
          homeTeamId,
          awayTeamId
        ) || pickCandidate(bucsaCandidates, homeTeamId, awayTeamId);

      if (p.number == BUCSSA_NUMBERS.aida && aida) {
        match = aida;
      }
      if (!match && p.number == BUCSSA_NUMBERS.ariana && ariana) {
        match = ariana;
      }

      const byNumber = !match
        ? p.number == BUCSSA_NUMBERS.aida
          ? aida || preferForNumber(BUCSSA_NUMBERS.aida)
          : p.number == BUCSSA_NUMBERS.ariana
            ? ariana || preferForNumber(BUCSSA_NUMBERS.ariana)
            : null
        : null;

      // For entries with no number, avoid collapsing both sisters: pick by name prefix if present
      if (!match && p.name?.toLowerCase().includes("ari")) {
        match = ariana || preferForNumber(BUCSSA_NUMBERS.ariana) || match;
      }
      if (!match && p.name?.toLowerCase().includes("aid")) {
        match = aida || preferForNumber(BUCSSA_NUMBERS.aida) || match;
      }

      if (!match) match = byNumber;
      if (!match) match = pickCandidate(bucsaCandidates, homeTeamId, awayTeamId);
    }

    /* ---- 1) Exact abbrName match ---- */
    if (!match) {
      const candidates = allPlayers.filter(pl => pl._normAbbr == normPdf);
      match = pickCandidate(candidates, homeTeamId, awayTeamId);
    }

    /* ---- 2) Initial + surname match ---- */
    if (!match) {
      const { initial, surname } = splitPdfName(p.name);
      const candidates = allPlayers.filter(pl => {
        const parts = pl._normName.split(" ");
        const plInitial = parts[0]?.[0];
        const plSurname = parts.slice(1).join(" ");
        return plInitial === initial && plSurname === surname;
      });
      match = pickCandidate(candidates, homeTeamId, awayTeamId);
    }

    /* ---- 3) Surname-only (strict) ---- */
    if (!match) {
      const { surname } = splitPdfName(p.name);
      const candidates = allPlayers.filter(pl =>
        pl._normName.endsWith(surname)
      );
      match = pickCandidate(candidates, homeTeamId, awayTeamId);
    }

    if (!match) {
      resolved.push({
        ...p,
        unresolved: true
      });
      continue;
    }

    const overrideCanonical =
      CANONICAL_OVERRIDE[normPdf] || match.name || p.name;

    // If matched player belongs to a different team than current match teams, keep unresolved to avoid wrong-side rendering
    if (
      (homeTeamId || awayTeamId) &&
      match.teamID != homeTeamId &&
      match.teamID != awayTeamId &&
      match.teamId != homeTeamId &&
      match.teamId != awayTeamId
    ) {
      resolved.push({
        ...p,
        canonicalName: overrideCanonical,
        unresolved: true
      });
      continue;
    }

    resolved.push({
      ...p,
      playerId: match.playerID,
      teamId: match.teamID,
      canonicalName: overrideCanonical
    });
  }

  return resolved;
}
