import OpenAI from "openai";
import { db } from "../firebase/firebaseAdmin.js";
import { detectPrimaryRole } from "../grading/roleDetector.js";

const PLAYER_COLLECTION = "player";
const STATS_COLLECTION = "stats";
const MATCHES_COLLECTION = "matches";
const MIN_REQUIRED_LINEUP_PLAYERS = 8;
const TEAM_FORM_POINTS = 8;
const PLAYER_FORM_POINTS = 6;
const FORM_MATCH_SCAN_LIMIT = 80;
const TACTICAL_AI_MODEL = process.env.TACTICAL_AI_MODEL || "gpt-5.2";
const TACTICAL_AI_TEMPERATURE = 0.2;

let openai = null;

const getOpenAI = () => {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key) {
      openai = new OpenAI({ apiKey: key });
    }
  }
  return openai;
};

const KNOWN_ROLES = new Set([
  "GK",
  "CB",
  "FULLBACK",
  "WINGBACK",
  "MIDFIELDER",
  "WINGER",
  "ATTACKER",
  "GENERIC"
]);

const FORMATION_SLOTS = {
  "4-3-3": [
    { slot: "GK", roles: ["GK"] },
    { slot: "RB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RCB", roles: ["CB", "FULLBACK"] },
    { slot: "LCB", roles: ["CB", "FULLBACK"] },
    { slot: "LB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "CM", roles: ["MIDFIELDER"] },
    { slot: "LCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "RW", roles: ["WINGER", "ATTACKER", "MIDFIELDER"] },
    { slot: "ST", roles: ["ATTACKER", "WINGER"] },
    { slot: "LW", roles: ["WINGER", "ATTACKER", "MIDFIELDER"] }
  ],
  "4-2-3-1": [
    { slot: "GK", roles: ["GK"] },
    { slot: "RB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RCB", roles: ["CB", "FULLBACK"] },
    { slot: "LCB", roles: ["CB", "FULLBACK"] },
    { slot: "LB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RDM", roles: ["MIDFIELDER", "CB"] },
    { slot: "LDM", roles: ["MIDFIELDER", "CB"] },
    { slot: "CAM", roles: ["MIDFIELDER", "WINGER", "ATTACKER"] },
    { slot: "RW", roles: ["WINGER", "ATTACKER", "MIDFIELDER"] },
    { slot: "LW", roles: ["WINGER", "ATTACKER", "MIDFIELDER"] },
    { slot: "ST", roles: ["ATTACKER", "WINGER"] }
  ],
  "4-4-2": [
    { slot: "GK", roles: ["GK"] },
    { slot: "RB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RCB", roles: ["CB", "FULLBACK"] },
    { slot: "LCB", roles: ["CB", "FULLBACK"] },
    { slot: "LB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RM", roles: ["WINGER", "MIDFIELDER", "ATTACKER"] },
    { slot: "RCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "LCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "LM", roles: ["WINGER", "MIDFIELDER", "ATTACKER"] },
    { slot: "RST", roles: ["ATTACKER", "WINGER"] },
    { slot: "LST", roles: ["ATTACKER", "WINGER"] }
  ],
  "4-3-1-2": [
    { slot: "GK", roles: ["GK"] },
    { slot: "RB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "RCB", roles: ["CB", "FULLBACK"] },
    { slot: "LCB", roles: ["CB", "FULLBACK"] },
    { slot: "LB", roles: ["FULLBACK", "WINGBACK", "CB"] },
    { slot: "DM", roles: ["MIDFIELDER", "CB"] },
    { slot: "RCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "LCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "CAM", roles: ["MIDFIELDER", "WINGER", "ATTACKER"] },
    { slot: "RST", roles: ["ATTACKER", "WINGER"] },
    { slot: "LST", roles: ["ATTACKER", "WINGER"] }
  ],
  "3-4-3": [
    { slot: "GK", roles: ["GK"] },
    { slot: "RCB", roles: ["CB", "FULLBACK"] },
    { slot: "CB", roles: ["CB", "FULLBACK"] },
    { slot: "LCB", roles: ["CB", "FULLBACK"] },
    { slot: "RM", roles: ["WINGER", "MIDFIELDER", "WINGBACK"] },
    { slot: "RCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "LCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "LM", roles: ["WINGER", "MIDFIELDER", "WINGBACK"] },
    { slot: "RW", roles: ["WINGER", "ATTACKER", "MIDFIELDER"] },
    { slot: "ST", roles: ["ATTACKER", "WINGER"] },
    { slot: "LW", roles: ["WINGER", "ATTACKER", "MIDFIELDER"] }
  ],
  "3-5-2": [
    { slot: "GK", roles: ["GK"] },
    { slot: "RCB", roles: ["CB", "FULLBACK"] },
    { slot: "CB", roles: ["CB", "FULLBACK"] },
    { slot: "LCB", roles: ["CB", "FULLBACK"] },
    { slot: "RWB", roles: ["WINGBACK", "FULLBACK", "WINGER"] },
    { slot: "LWB", roles: ["WINGBACK", "FULLBACK", "WINGER"] },
    { slot: "RCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "LCM", roles: ["MIDFIELDER", "WINGER"] },
    { slot: "CAM", roles: ["MIDFIELDER", "WINGER", "ATTACKER"] },
    { slot: "RST", roles: ["ATTACKER", "WINGER"] },
    { slot: "LST", roles: ["ATTACKER", "WINGER"] }
  ]
};

const FORMATION_PROFILES = {
  "4-3-3": {
    wingers: 2,
    wingbacks: 0,
    centralMidfielders: 3,
    strikers: 1,
    doublePivot: false,
    backThree: false
  },
  "4-2-3-1": {
    wingers: 2,
    wingbacks: 0,
    centralMidfielders: 3,
    strikers: 1,
    doublePivot: true,
    backThree: false
  },
  "4-4-2": {
    wingers: 2,
    wingbacks: 0,
    centralMidfielders: 2,
    strikers: 2,
    doublePivot: false,
    backThree: false
  },
  "4-3-1-2": {
    wingers: 0,
    wingbacks: 0,
    centralMidfielders: 4,
    strikers: 2,
    doublePivot: false,
    backThree: false
  },
  "3-4-3": {
    wingers: 2,
    wingbacks: 0,
    centralMidfielders: 2,
    strikers: 1,
    doublePivot: false,
    backThree: true
  },
  "3-5-2": {
    wingers: 0,
    wingbacks: 2,
    centralMidfielders: 3,
    strikers: 2,
    doublePivot: false,
    backThree: true
  }
};

const FORMATION_POSITION_TEMPLATE = {
  "4-3-3": ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "RW", "ST", "LW"],
  "4-2-3-1": ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "CAM", "RW", "LW", "ST"],
  "4-4-2": ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "RST", "LST"],
  "4-3-1-2": ["GK", "RB", "RCB", "LCB", "LB", "DM", "RCM", "LCM", "CAM", "RST", "LST"],
  "3-4-3": ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RW", "ST", "LW"],
  "3-5-2": ["GK", "RCB", "CB", "LCB", "RWB", "LWB", "RCM", "LCM", "CAM", "RST", "LST"]
};

const OPPONENT_DEFAULT_FORMATION = "4-3-3";
const ROLE_GROUPS = {
  GK: "gk",
  CB: "defense",
  FULLBACK: "defense",
  WINGBACK: "defense",
  MIDFIELDER: "midfield",
  WINGER: "attack",
  ATTACKER: "attack",
  GENERIC: "generic"
};

const POSITION_ALIASES = {
  GK: "GK",
  GOALKEEPER: "GK",
  KEEPER: "GK",
  RB: "RB",
  RIGHTBACK: "RB",
  LB: "LB",
  LEFTBACK: "LB",
  RWB: "RWB",
  RIGHTWINGBACK: "RWB",
  LWB: "LWB",
  LEFTWINGBACK: "LWB",
  CB: "CB",
  CENTREBACK: "CB",
  CENTERBACK: "CB",
  RCB: "CB",
  LCB: "CB",
  DM: "DM",
  RDM: "DM",
  LDM: "DM",
  CDM: "DM",
  DEFENSIVEMIDFIELDER: "DM",
  CM: "CM",
  RCM: "CM",
  LCM: "CM",
  CENTRALMIDFIELDER: "CM",
  AM: "AM",
  CAM: "AM",
  ATTACKINGMIDFIELDER: "AM",
  RM: "RM",
  RIGHTMIDFIELDER: "RM",
  LM: "LM",
  LEFTMIDFIELDER: "LM",
  RW: "RW",
  RWF: "RW",
  RIGHTWINGER: "RW",
  LW: "LW",
  LWF: "LW",
  LEFTWINGER: "LW",
  ST: "ST",
  RST: "ST",
  LST: "ST",
  CF: "ST",
  STRIKER: "ST",
  FORWARD: "ST",
  ATTACKER: "ST",
  DEFENDER: "CB",
  DEFENCE: "CB",
  DEFENCEPLAYER: "CB",
  MIDFIELDER: "CM",
  CENTREFORWARD: "ST",
  CENTERFORWARD: "ST",
  SS: "ST",
  SECONDSTRIKER: "ST"
};

const DEFENSIVE_POSITIONS = new Set(["CB", "RB", "LB", "RWB", "LWB"]);
const MIDFIELD_POSITIONS = new Set(["DM", "CM", "AM", "RM", "LM"]);
const ATTACK_POSITIONS = new Set(["RW", "LW", "ST"]);

const ROLE_STRENGTH_METRICS = {
  GK: [
    ["savePct", "Shot stopping"],
    ["saves_p90", "Saves"],
    ["xCG_diff_p90", "xCG prevention"],
    ["passAccuracy", "Distribution"]
  ],
  CB: [
    ["defensiveDuelWinPct", "Defensive duels"],
    ["interceptions_p90", "Interceptions"],
    ["recoveries_p90", "Recoveries"],
    ["passAccuracy", "Ball progression"]
  ],
  FULLBACK: [
    ["crossesAccurate_p90", "Crossing"],
    ["progressiveRuns_p90", "Progressive runs"],
    ["defensiveDuelWinPct", "Defensive duels"],
    ["assists_p90", "Final third impact"]
  ],
  WINGBACK: [
    ["crossesAccurate_p90", "Crossing"],
    ["progressiveRuns_p90", "Progressive runs"],
    ["defensiveDuelWinPct", "Defensive duels"],
    ["assists_p90", "Final third impact"]
  ],
  MIDFIELDER: [
    ["passAccuracy", "Passing control"],
    ["progressivePasses_p90", "Progressive passing"],
    ["throughPasses_p90", "Line-breaking passes"],
    ["duelWinPct", "Midfield duels"]
  ],
  WINGER: [
    ["dribbles_p90", "1v1 ability"],
    ["progressiveRuns_p90", "Carries"],
    ["xA_p90", "Chance creation"],
    ["goals_p90", "Goal threat"]
  ],
  ATTACKER: [
    ["goals_p90", "Finishing"],
    ["xG_p90", "Chance quality"],
    ["shotsOnTarget_p90", "Shot volume"],
    ["duelWinPct", "Forward duels"]
  ],
  GENERIC: [
    ["duelWinPct", "Duels"],
    ["passAccuracy", "Passing"],
    ["recoveries_p90", "Recoveries"],
    ["progressiveRuns_p90", "Progressive actions"]
  ]
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeStringList = (value, { min = 0, max = 6, fallback = [] } = {}) => {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
  return items.length >= min ? items : fallback;
};

const parseAiJson = raw => {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (nestedError) {
      return null;
    }
  }
};

const normalizeIdScalar = value => {
  if (value == null) return [];
  const candidates = [];
  const seen = new Set();
  const add = candidate => {
    const key = `${typeof candidate}:${String(candidate)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  if (typeof value === "number" && Number.isFinite(value)) {
    add(value);
    add(String(value));
    return candidates;
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) return candidates;
  add(trimmed);
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) add(parsed);
  return candidates;
};

const normalizeFormation = formation => {
  const raw = String(formation || "").trim();
  if (!raw) return null;

  if (FORMATION_SLOTS[raw]) return raw;

  const compact = raw
    .toLowerCase()
    .replace(/[()\s]/g, "");
  if (compact === "4-4-2diamond" || compact === "442diamond") {
    return "4-3-1-2";
  }

  const numeric = raw.replace(/\s+/g, "");
  if (/^\d(?:-\d){2,3}$/.test(numeric) && FORMATION_SLOTS[numeric]) {
    return numeric;
  }

  return null;
};

const normalizeMatchVenue = value => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "home" || raw === "away") return raw;
  return null;
};

const canonicalPosition = value => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!normalized) return "UNKNOWN";
  if (POSITION_ALIASES[normalized]) return POSITION_ALIASES[normalized];
  return normalized.length <= 3 ? normalized : "UNKNOWN";
};

const extractCanonicalPositions = value =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[,/|;]/g)
        .map(entry => canonicalPosition(entry))
        .filter(position => position && position !== "UNKNOWN")
    )
  );

const roleFromPosition = position => {
  if (position === "GK") return "GK";
  if (position === "CB") return "CB";
  if (position === "RB" || position === "LB") return "FULLBACK";
  if (position === "RWB" || position === "LWB") return "WINGBACK";
  if (["DM", "CM", "AM", "RM", "LM"].includes(position)) return "MIDFIELDER";
  if (["RW", "LW"].includes(position)) return "WINGER";
  if (position === "ST") return "ATTACKER";
  return "GENERIC";
};

const roleFromPositionText = value => {
  const chunks = extractCanonicalPositions(value);

  if (!chunks.length) return "GENERIC";

  const roleCounts = {};
  chunks.forEach(position => {
    const role = roleFromPosition(position);
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  return Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "GENERIC";
};

const deriveFallbackScoreByRole = (stats, role) => {
  const derived = stats?.derived || {};
  const goals = toNumber(derived.goals_p90) || 0;
  const assists = toNumber(derived.assists_p90) || 0;
  const xA = toNumber(derived.xA_p90) || 0;
  const xG = toNumber(derived.xG_p90) || 0;
  const dribbles = toNumber(derived.dribbles_p90) || 0;
  const interceptions = toNumber(derived.interceptions_p90) || 0;
  const defensiveDuelWinPct = toNumber(derived.defensiveDuelWinPct) || 0;
  const duelWinPct = toNumber(derived.duelWinPct) || 0;
  const passes = toNumber(derived.passes_p90) || 0;
  const passAccuracy = toNumber(derived.passAccuracy) || 0;
  const savePct = toNumber(derived.savePct) || 0;

  let score = 55;

  if (role === "ATTACKER") {
    score += goals * 18 + xG * 10 + assists * 7;
  } else if (role === "WINGER") {
    score += dribbles * 4 + assists * 11 + xA * 12 + goals * 10;
  } else if (role === "MIDFIELDER") {
    score += passes * 0.5 + passAccuracy * 18 + (toNumber(derived.progressivePasses_p90) || 0) * 2.2;
  } else if (role === "CB" || role === "FULLBACK" || role === "WINGBACK") {
    score += interceptions * 4 + defensiveDuelWinPct * 20 + duelWinPct * 12;
  } else if (role === "GK") {
    score += savePct * 30 + (toNumber(derived.saves_p90) || 0) * 3;
  } else {
    score += duelWinPct * 12 + passAccuracy * 12;
  }

  return clamp(score, 35, 95);
};

const resolvePlayerRole = ({ player, stats }) => {
  const roleFromProfile = String(stats?.roleProfile?.primaryRole || "").trim().toUpperCase();
  if (KNOWN_ROLES.has(roleFromProfile)) return roleFromProfile;

  const roleFromStats = String(stats?.primaryRole || "").trim().toUpperCase();
  if (KNOWN_ROLES.has(roleFromStats)) return roleFromStats;

  if (Array.isArray(stats?.positions) && stats.positions.length) {
    const profile = detectPrimaryRole(stats.positions, "GENERIC");
    const profileRole = String(profile?.primaryRole || "").trim().toUpperCase();
    if (KNOWN_ROLES.has(profileRole)) return profileRole;
  }

  const inferred = roleFromPositionText(player?.position);
  return KNOWN_ROLES.has(inferred) ? inferred : "GENERIC";
};

const inferNaturalPositionsByRole = role => {
  if (role === "GK") return ["GK"];
  if (role === "CB") return ["CB"];
  if (role === "FULLBACK") return ["RB", "LB"];
  if (role === "WINGBACK") return ["RWB", "LWB"];
  if (role === "MIDFIELDER") return ["CM"];
  if (role === "WINGER") return ["RW", "LW"];
  if (role === "ATTACKER") return ["ST"];
  return [];
};

const selectBestStatsDoc = docs => {
  if (!Array.isArray(docs) || !docs.length) return null;
  return docs
    .map((docSnap, index) => {
      const data = docSnap.data() || {};
      const seasonGrade = data.seasonGrade || {};
      const overall = toNumber(seasonGrade.overall100) ?? ((toNumber(seasonGrade.overall10) ?? 0) * 10);
      const confidence = toNumber(seasonGrade.confidence) ?? clamp((toNumber(data.minutes) || 0) / 900);
      const minutes = toNumber(data.minutes) || 0;
      const score = overall * 100 + confidence * 10 + minutes;
      return { docSnap, data, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0];
};

const fetchBestStatsForPlayer = async playerID => {
  const candidates = normalizeIdScalar(playerID);
  if (!candidates.length) return null;

  const snapshots = await Promise.all(
    candidates.map(candidate =>
      db
        .collection(STATS_COLLECTION)
        .where("playerID", "==", candidate)
        .get()
    )
  );

  const docs = [];
  const seen = new Set();
  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(docSnap => {
      if (seen.has(docSnap.id)) return;
      seen.add(docSnap.id);
      docs.push(docSnap);
    });
  });

  return selectBestStatsDoc(docs);
};

const playerKeyCandidates = playerData => {
  const candidates = [];
  const raw = [playerData?.name, playerData?.canonicalName, playerData?.abbrName];
  raw.forEach(value => {
    const key = normalizeText(value);
    if (key) candidates.push(key);
  });
  return Array.from(new Set(candidates));
};

const matchesNormalizedTeam = (candidate, target) => {
  if (!candidate || !target) return false;
  if (candidate === target) return true;
  return candidate.includes(target) || target.includes(candidate);
};

const readMatchEntryGrade = entry => {
  const value =
    entry?.gameGrade?.overall10 ??
    entry?.gameGrade?.overall ??
    entry?.grade ??
    entry?.rating ??
    null;
  const parsed = toNumber(value);
  return parsed == null ? null : Math.round(parsed * 10) / 10;
};

const parseMatchDateValue = value => {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isFinite(date?.getTime?.()) ? date.getTime() : null;
  }
  if (typeof value === "object") {
    if (typeof value.seconds === "number") return value.seconds * 1000;
    if (typeof value._seconds === "number") return value._seconds * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMatchDateShort = value => {
  const ms = parseMatchDateValue(value);
  if (!Number.isFinite(ms)) return String(value || "");
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(ms));
  } catch (error) {
    return String(value || "");
  }
};

const resolveTeamSideInMatch = ({ match, teamName }) => {
  const teamKey = normalizeText(teamName);
  if (!teamKey) return null;
  const homeKey = normalizeText(match?.homeTeam || "");
  const awayKey = normalizeText(match?.awayTeam || "");
  if (matchesNormalizedTeam(homeKey, teamKey)) return "home";
  if (matchesNormalizedTeam(awayKey, teamKey)) return "away";
  return null;
};

const average = values =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const buildTeamFormSeries = ({ matches, teamName, maxPoints = TEAM_FORM_POINTS }) => {
  if (!teamName || !Array.isArray(matches) || !matches.length) return [];

  const series = [];
  for (const match of matches) {
    if (series.length >= maxPoints) break;
    const side = resolveTeamSideInMatch({ match, teamName });
    if (!side) continue;

    const playersArr = Array.isArray(match?.players) ? match.players : [];
    const sideEntries = playersArr.filter(entry => entry?.team === side);
    const grades = sideEntries
      .map(readMatchEntryGrade)
      .filter(value => value != null);
    if (!grades.length) continue;

    const opponentName = side === "home" ? match?.awayTeam || "Opponent" : match?.homeTeam || "Opponent";
    const avgGrade = average(grades);
    series.push({
      matchId: match?.id || null,
      date: match?.date || null,
      dateMs: parseMatchDateValue(match?.date),
      label: formatMatchDateShort(match?.date),
      opponent: opponentName,
      grade: avgGrade != null ? Math.round(avgGrade * 10) / 10 : null
    });
  }

  return series.reverse();
};

const resolvePlayerEntryInMatchForForm = ({ playersArr, target }) => {
  const targetPlayerId = target?.playerID;
  const targetNameKey = normalizeText(target?.name);

  return playersArr.find(entry => {
    const entryPlayerId = entry?.playerId ?? entry?.playerID;
    if (entryPlayerId != null && targetPlayerId != null && String(entryPlayerId) === String(targetPlayerId)) {
      return true;
    }
    if (!targetNameKey) return false;
    const entryNameKey = normalizeText(entry?.canonicalName || entry?.name || entry?.abbrName || "");
    return entryNameKey && entryNameKey === targetNameKey;
  });
};

const buildPlayerFormSeriesByLineup = ({
  matches,
  recommendation,
  squadProfilesByDocId,
  maxPoints = PLAYER_FORM_POINTS
}) => {
  if (!recommendation?.lineup?.length) return [];

  const trackedPlayers = recommendation.lineup
    .map(entry => {
      const profile = squadProfilesByDocId.get(entry.playerDocId);
      if (!profile) return null;
      return {
        slot: entry.slot,
        playerDocId: entry.playerDocId,
        playerID: profile.playerID ?? null,
        name: profile.name || entry.name || "Unknown",
        role: profile.role || entry.role || "GENERIC",
        points: []
      };
    })
    .filter(Boolean);

  if (!trackedPlayers.length) return [];

  for (const match of matches) {
    const playersArr = Array.isArray(match?.players) ? match.players : [];
    trackedPlayers.forEach(target => {
      if (target.points.length >= maxPoints) return;
      const entry = resolvePlayerEntryInMatchForForm({ playersArr, target });
      if (!entry) return;
      const grade = readMatchEntryGrade(entry);
      if (grade == null) return;

      const side = entry?.team;
      const opponentName =
        side === "home"
          ? match?.awayTeam || "Opponent"
          : side === "away"
            ? match?.homeTeam || "Opponent"
            : match?.awayTeam || match?.homeTeam || "Opponent";

      target.points.push({
        matchId: match?.id || null,
        date: match?.date || null,
        dateMs: parseMatchDateValue(match?.date),
        label: formatMatchDateShort(match?.date),
        opponent: opponentName,
        grade
      });
    });

    if (trackedPlayers.every(target => target.points.length >= maxPoints)) break;
  }

  return trackedPlayers.map(player => ({
    slot: player.slot,
    playerDocId: player.playerDocId,
    playerID: player.playerID,
    name: player.name,
    role: player.role,
    series: player.points.reverse()
  }));
};

const fetchFormCharts = async ({
  ownTeamName,
  opponentTeamName,
  recommendation,
  squadProfilesByDocId
}) => {
  try {
    const matchesSnapshot = await db
      .collection(MATCHES_COLLECTION)
      .orderBy("date", "desc")
      .limit(FORM_MATCH_SCAN_LIMIT)
      .get();

    const matches = matchesSnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    return {
      teams: {
        ownTeamName: ownTeamName || "Your team",
        opponentTeamName: opponentTeamName || "Opponent",
        ownSeries: buildTeamFormSeries({ matches, teamName: ownTeamName }),
        opponentSeries: buildTeamFormSeries({ matches, teamName: opponentTeamName })
      },
      players: buildPlayerFormSeriesByLineup({
        matches,
        recommendation,
        squadProfilesByDocId
      })
    };
  } catch (error) {
    console.warn("[tacticalPlanner] Form chart data unavailable:", error?.message || error);
    return {
      teams: {
        ownTeamName: ownTeamName || "Your team",
        opponentTeamName: opponentTeamName || "Opponent",
        ownSeries: [],
        opponentSeries: []
      },
      players: []
    };
  }
};

const fetchTeamPlayers = async ({ teamName, teamId }) => {
  const normalizedTargetTeam = normalizeText(teamName);
  const idCandidates = normalizeIdScalar(teamId);
  const byId = new Map();

  const addSnapshot = snapshot => {
    snapshot.docs.forEach(docSnap => {
      byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });
  };

  if (idCandidates.length) {
    await Promise.all(
      idCandidates.map(async candidate => {
        const snapshot = await db
          .collection(PLAYER_COLLECTION)
          .where("teamID", "==", candidate)
          .get();
        addSnapshot(snapshot);
      })
    );
  }

  if (teamName) {
    const [teamNameSnap, teamAliasSnap] = await Promise.all([
      db
        .collection(PLAYER_COLLECTION)
        .where("teamName", "==", teamName)
        .get(),
      db
        .collection(PLAYER_COLLECTION)
        .where("team", "==", teamName)
        .get()
    ]);
    addSnapshot(teamNameSnap);
    addSnapshot(teamAliasSnap);
  }

  if (byId.size >= 11) return Array.from(byId.values());

  const fullSnapshot = await db.collection(PLAYER_COLLECTION).get();
  fullSnapshot.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const candidateTeam = normalizeText(data.teamName || data.team || "");
    const candidateIds = normalizeIdScalar(data.teamID);

    const teamMatches =
      normalizedTargetTeam && matchesNormalizedTeam(candidateTeam, normalizedTargetTeam);
    const idMatches =
      idCandidates.length &&
      candidateIds.some(value => idCandidates.some(target => String(target) === String(value)));

    if (!teamMatches && !idMatches) return;
    byId.set(docSnap.id, { id: docSnap.id, ...data });
  });

  return Array.from(byId.values());
};

const buildStrengthTags = ({ role, stats }) => {
  const derived = stats?.derived || {};
  const checks = ROLE_STRENGTH_METRICS[role] || ROLE_STRENGTH_METRICS.GENERIC;
  const scored = checks
    .map(([metric, label]) => {
      const value = toNumber(derived[metric]);
      if (value == null) return null;
      return { label, value };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map(entry => entry.label);

  return scored;
};

const buildPlayerProfile = async player => {
  const statsDoc = await fetchBestStatsForPlayer(player.playerID);
  const stats = statsDoc?.data || {};
  const role = resolvePlayerRole({ player, stats });
  const naturalPositionsRaw = extractCanonicalPositions(player?.position);
  const naturalPositions = naturalPositionsRaw.length
    ? naturalPositionsRaw
    : inferNaturalPositionsByRole(role);

  const seasonGrade = stats?.seasonGrade || {};
  const grade100 =
    toNumber(seasonGrade.overall100) ??
    ((toNumber(seasonGrade.overall10) != null ? toNumber(seasonGrade.overall10) * 10 : null));
  const minutes = toNumber(stats?.minutes) || 0;
  const confidence = clamp(
    toNumber(seasonGrade.confidence) ?? (minutes > 0 ? minutes / 900 : 0),
    0,
    1
  );
  const base = grade100 ?? deriveFallbackScoreByRole(stats, role);
  const adjustedScore = clamp(base * (0.62 + confidence * 0.38) + Math.min(minutes / 200, 7), 30, 99);
  const strengths = buildStrengthTags({ role, stats });

  return {
    id: player.id,
    playerID: player.playerID ?? null,
    name: player.name || "Unknown",
    teamName: player.teamName || player.team || null,
    position: player.position || null,
    naturalPositions,
    role,
    minutes,
    baseScore: Math.round(base * 10) / 10,
    adjustedScore: Math.round(adjustedScore * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    strengths,
    stats
  };
};

const slotGroup = slot => {
  if (slot.includes("GK")) return "gk";
  if (
    slot.includes("CB") ||
    slot.includes("RB") ||
    slot.includes("LB") ||
    slot.includes("WB")
  ) {
    return "defense";
  }
  if (
    slot.includes("CM") ||
    slot.includes("DM") ||
    slot.includes("CAM") ||
    slot === "AM"
  ) {
    return "midfield";
  }
  if (
    slot.includes("RW") ||
    slot.includes("LW") ||
    slot.includes("RM") ||
    slot.includes("LM") ||
    slot.includes("ST")
  ) {
    return "attack";
  }
  return "generic";
};

const positionLine = position => {
  if (position === "GK") return "gk";
  if (DEFENSIVE_POSITIONS.has(position)) return "defense";
  if (MIDFIELD_POSITIONS.has(position)) return "midfield";
  if (ATTACK_POSITIONS.has(position)) return "attack";
  return "generic";
};

const canonicalSlotPosition = slot => {
  if (slot === "GK") return "GK";
  if (slot.includes("CB")) return "CB";
  if (slot === "RB") return "RB";
  if (slot === "LB") return "LB";
  if (slot === "RWB") return "RWB";
  if (slot === "LWB") return "LWB";
  if (slot === "RDM" || slot === "LDM" || slot === "DM") return "DM";
  if (slot === "RCM" || slot === "LCM" || slot === "CM") return "CM";
  if (slot === "CAM") return "AM";
  if (slot === "RM") return "RM";
  if (slot === "LM") return "LM";
  if (slot === "RW") return "RW";
  if (slot === "LW") return "LW";
  if (slot.includes("ST")) return "ST";
  return "UNKNOWN";
};

const isGoalkeeperProfile = player =>
  player?.role === "GK" || Array.isArray(player?.naturalPositions) && player.naturalPositions.includes("GK");

const isDefensiveProfile = player =>
  ["CB", "FULLBACK", "WINGBACK"].includes(player?.role) ||
  (Array.isArray(player?.naturalPositions) &&
    player.naturalPositions.some(position => DEFENSIVE_POSITIONS.has(position)));

const areAdjacentLines = (a, b) =>
  (a === "defense" && b === "midfield") ||
  (a === "midfield" && b === "defense") ||
  (a === "midfield" && b === "attack") ||
  (a === "attack" && b === "midfield");

const naturalPositionMultiplier = ({ slot, naturalPositions = [] }) => {
  if (!Array.isArray(naturalPositions) || !naturalPositions.length) return 1;

  const slotPos = canonicalSlotPosition(slot);
  const slotLine = slotGroup(slot);

  if (slotPos !== "UNKNOWN" && naturalPositions.includes(slotPos)) return 1.16;
  if (slotPos === "CB" && naturalPositions.some(pos => ["RB", "LB"].includes(pos))) return 1.06;
  if (slotPos === "RB" && naturalPositions.includes("RWB")) return 1.08;
  if (slotPos === "LB" && naturalPositions.includes("LWB")) return 1.08;
  if (slotPos === "RM" && naturalPositions.includes("RW")) return 1.06;
  if (slotPos === "LM" && naturalPositions.includes("LW")) return 1.06;
  if (slotPos === "RW" && naturalPositions.includes("RM")) return 1.06;
  if (slotPos === "LW" && naturalPositions.includes("LM")) return 1.06;

  const naturalLines = new Set(naturalPositions.map(positionLine));
  if (naturalLines.has(slotLine)) return 0.96;
  if ([...naturalLines].some(line => areAdjacentLines(line, slotLine))) return 0.8;
  return 0.62;
};

const roleFitMultiplier = (role, preferredRoles) => {
  if (!Array.isArray(preferredRoles) || !preferredRoles.length) return 0.8;
  const slotPrimaryRole = preferredRoles[0];

  if (slotPrimaryRole === "GK") return role === "GK" ? 1.24 : 0.02;
  if (role === "GK") return 0.02;

  const index = preferredRoles.indexOf(role);
  if (index === 0) return 1.2;
  if (index > 0) return 1.08;

  const roleGroup = ROLE_GROUPS[role] || "generic";
  const primaryGroup = ROLE_GROUPS[slotPrimaryRole] || "generic";
  if (roleGroup === primaryGroup && roleGroup !== "generic") return 0.86;
  if (roleGroup === "generic") return 0.55;
  if (areAdjacentLines(roleGroup, primaryGroup)) return 0.42;
  return 0.28;
};

const metricScale = (value, min, max) => {
  const v = toNumber(value);
  if (v == null) return 0;
  if (max <= min) return 0;
  return clamp((v - min) / (max - min), 0, 1);
};

const slotTraitBonus = (slot, stats) => {
  const derived = stats?.derived || {};
  const group = slotGroup(slot);

  if (slot.includes("ST")) {
    return (
      metricScale(derived.goals_p90, 0.05, 0.9) * 5 +
      metricScale(derived.xG_p90, 0.1, 0.9) * 3 +
      metricScale(derived.shotsOnTarget_p90, 0.3, 2.5) * 2
    );
  }

  if (slot.includes("RW") || slot.includes("LW") || slot.includes("RM") || slot.includes("LM")) {
    return (
      metricScale(derived.dribbles_p90, 0.5, 7) * 4 +
      metricScale(derived.xA_p90, 0.05, 0.5) * 3 +
      metricScale(derived.progressiveRuns_p90, 0.3, 5) * 3
    );
  }

  if (slot.includes("CB")) {
    return (
      metricScale(derived.defensiveDuelWinPct, 0.35, 0.75) * 4 +
      metricScale(derived.interceptions_p90, 0.4, 4.5) * 3 +
      metricScale(derived.recoveries_p90, 1, 11) * 3
    );
  }

  if (slot.includes("RB") || slot.includes("LB") || slot.includes("WB")) {
    return (
      metricScale(derived.crossesAccurate_p90, 0.1, 2.2) * 3 +
      metricScale(derived.progressiveRuns_p90, 0.3, 5) * 4 +
      metricScale(derived.defensiveDuelWinPct, 0.35, 0.75) * 3
    );
  }

  if (group === "midfield") {
    return (
      metricScale(derived.passAccuracy, 0.55, 0.9) * 4 +
      metricScale(derived.progressivePasses_p90, 1.5, 12) * 3 +
      metricScale(derived.throughPasses_p90, 0, 1.8) * 3
    );
  }

  if (group === "gk") {
    return (
      metricScale(derived.savePct, 0.45, 0.85) * 5 +
      metricScale(derived.saves_p90, 1.5, 6) * 3 +
      metricScale(derived.passAccuracy, 0.45, 0.85) * 2
    );
  }

  return 0;
};

const inferOpponentFormation = lineup => {
  if (!Array.isArray(lineup) || !lineup.length) return OPPONENT_DEFAULT_FORMATION;
  const defenders = lineup.filter(entry =>
    ["CB", "RB", "LB", "RWB", "LWB"].includes(entry.position)
  ).length;
  const midfielders = lineup.filter(entry =>
    ["DM", "CM", "AM", "RM", "LM"].includes(entry.position)
  ).length;
  const attackers = lineup.filter(entry =>
    ["RW", "LW", "ST"].includes(entry.position)
  ).length;
  const hasDm = lineup.some(entry => entry.position === "DM");
  const hasAm = lineup.some(entry => entry.position === "AM");

  if (defenders === 3 && attackers >= 3) return "3-4-3";
  if (defenders === 3 && midfielders >= 4 && attackers >= 2) return "3-5-2";
  if (defenders === 4 && attackers >= 2 && hasDm && hasAm) return "4-3-1-2";
  if (defenders === 4 && midfielders >= 4 && attackers >= 2) return "4-4-2";
  if (defenders === 4 && midfielders >= 2 && attackers >= 3) return "4-3-3";
  return OPPONENT_DEFAULT_FORMATION;
};

const normalizeOpponentLineup = ({ opponentLineup, opponentFormation }) => {
  const normalizedFormation = normalizeFormation(opponentFormation) || OPPONENT_DEFAULT_FORMATION;
  const template = FORMATION_POSITION_TEMPLATE[normalizedFormation] || FORMATION_POSITION_TEMPLATE[OPPONENT_DEFAULT_FORMATION];
  const rawLineup = Array.isArray(opponentLineup) ? opponentLineup.slice(0, 11) : [];
  const lineup = template.map((fallbackPosition, index) => {
    const source = rawLineup[index] || {};
    const name = String(source.name || "").trim();
    const position = canonicalPosition(source.position || fallbackPosition);
    return {
      index,
      name,
      position,
      role: roleFromPosition(position)
    };
  });

  const hasEnoughPredictions = lineup.filter(entry => entry.position !== "UNKNOWN").length >= MIN_REQUIRED_LINEUP_PLAYERS;
  if (!hasEnoughPredictions) {
    const error = new Error("Please provide at least 8 opponent players with positions.");
    error.status = 400;
    throw error;
  }

  return {
    formation: normalizeFormation(opponentFormation) || inferOpponentFormation(lineup),
    lineup
  };
};

const enrichOpponentWithKnownData = async ({ lineup, opponentTeamName }) => {
  const namedEntries = lineup
    .map(entry => ({ ...entry, nameKey: normalizeText(entry.name) }))
    .filter(entry => entry.nameKey.length >= 3);
  if (!namedEntries.length) return lineup;

  const teamKey = normalizeText(opponentTeamName);
  const allPlayersSnap = await db.collection(PLAYER_COLLECTION).get();
  const nameToCandidates = new Map();

  allPlayersSnap.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const playerPayload = { id: docSnap.id, ...data };
    playerKeyCandidates(data).forEach(key => {
      if (!nameToCandidates.has(key)) nameToCandidates.set(key, []);
      nameToCandidates.get(key).push(playerPayload);
    });
  });

  const statsByPlayerDoc = new Map();

  const resolveCandidate = async entry => {
    const candidates = nameToCandidates.get(entry.nameKey) || [];
    if (!candidates.length) return null;

    const filteredByTeam = teamKey
      ? candidates.filter(candidate =>
          matchesNormalizedTeam(normalizeText(candidate.teamName || candidate.team || ""), teamKey)
        )
      : candidates;
    const selected = filteredByTeam[0] || candidates[0];
    if (!selected) return null;

    if (!statsByPlayerDoc.has(selected.id)) {
      const statsDoc = await fetchBestStatsForPlayer(selected.playerID);
      statsByPlayerDoc.set(selected.id, statsDoc?.data || {});
    }

    const stats = statsByPlayerDoc.get(selected.id) || {};
    const seasonGrade = stats.seasonGrade || {};
    const quality =
      toNumber(seasonGrade.overall100) ??
      (toNumber(seasonGrade.overall10) != null ? toNumber(seasonGrade.overall10) * 10 : null);

    return {
      matchedPlayerDocId: selected.id,
      matchedPlayerName: selected.name || null,
      knownQuality: quality != null ? Math.round(quality * 10) / 10 : null
    };
  };

  const resolved = await Promise.all(
    lineup.map(async entry => {
      const nameKey = normalizeText(entry.name);
      if (nameKey.length < 3) return entry;
      const extra = await resolveCandidate({ ...entry, nameKey });
      return extra ? { ...entry, ...extra } : entry;
    })
  );

  return resolved;
};

const analyzeOpponent = ({ formation, lineup }) => {
  const defenders = lineup.filter(entry =>
    ["CB", "RB", "LB", "RWB", "LWB"].includes(entry.position)
  ).length;
  const midfielders = lineup.filter(entry =>
    ["DM", "CM", "AM", "RM", "LM"].includes(entry.position)
  ).length;
  const attackers = lineup.filter(entry =>
    ["RW", "LW", "ST"].includes(entry.position)
  ).length;
  const strikers = lineup.filter(entry => entry.position === "ST").length;
  const wingbacks = lineup.filter(entry => entry.position === "RWB" || entry.position === "LWB").length;
  const doublePivot = lineup.filter(entry => entry.position === "DM").length >= 2;

  const lowQualityEntries = lineup.filter(
    entry =>
      entry.knownQuality != null &&
      entry.knownQuality < 60 &&
      ["GK", "CB", "RB", "LB", "RWB", "LWB", "DM", "CM"].includes(entry.position)
  );

  const weakZones = new Set();
  lowQualityEntries.forEach(entry => {
    if (["RB", "RWB"].includes(entry.position)) weakZones.add("right-flank");
    if (["LB", "LWB"].includes(entry.position)) weakZones.add("left-flank");
    if (["CB", "DM", "CM"].includes(entry.position)) weakZones.add("central-channel");
    if (entry.position === "GK") weakZones.add("goalkeeper");
  });

  const structuralWeaknesses = [];
  if (formation.startsWith("3-")) {
    structuralWeaknesses.push("Wing channels behind the back three.");
    weakZones.add("left-flank");
    weakZones.add("right-flank");
  }
  if (wingbacks >= 2) {
    structuralWeaknesses.push("Space appears behind wing-backs during transitions.");
    weakZones.add("left-flank");
    weakZones.add("right-flank");
  }
  if (midfielders <= 2) {
    structuralWeaknesses.push("Limited central midfield numbers.");
    weakZones.add("central-channel");
  }
  if (!doublePivot) {
    structuralWeaknesses.push("Single pivot can be overloaded between the lines.");
    weakZones.add("central-channel");
  }

  const flags = {
    flankVulnerable: weakZones.has("left-flank") || weakZones.has("right-flank"),
    centralVulnerable: weakZones.has("central-channel"),
    keeperVulnerable: weakZones.has("goalkeeper"),
    hasTwoStrikers: strikers >= 2,
    highWingbackRisk: wingbacks >= 2,
    lowMidfieldDensity: midfielders <= 2
  };

  return {
    formation,
    counts: {
      defenders,
      midfielders,
      attackers,
      strikers,
      wingbacks
    },
    lowQualityEntries,
    weakZones: Array.from(weakZones),
    structuralWeaknesses,
    flags
  };
};

const tacticalFormationBonus = ({ formation, opponentAnalysis }) => {
  const profile = FORMATION_PROFILES[formation];
  if (!profile) return 0;
  const flags = opponentAnalysis.flags;
  let bonus = 0;

  if (flags.flankVulnerable) {
    bonus += profile.wingers >= 2 ? 9 : 0;
    bonus += profile.wingbacks >= 2 ? 7 : 0;
  }
  if (flags.centralVulnerable) {
    bonus += profile.centralMidfielders >= 3 ? 8 : 3;
  }
  if (flags.hasTwoStrikers) {
    bonus += profile.doublePivot || profile.backThree ? 5 : 0;
  }
  if (flags.lowMidfieldDensity) {
    bonus += profile.centralMidfielders >= 3 ? 4 : 0;
  }

  return bonus;
};

const playerSlotScore = ({ player, slotDef, opponentAnalysis }) => {
  const fit = roleFitMultiplier(player.role, slotDef.roles);
  const naturalFit = naturalPositionMultiplier({
    slot: slotDef.slot,
    naturalPositions: player.naturalPositions || []
  });
  const trait = slotTraitBonus(slotDef.slot, player.stats);
  const slotArea = slotGroup(slotDef.slot);
  let matchupBonus = 0;

  if (opponentAnalysis.flags.flankVulnerable && (slotDef.slot.includes("W") || slotDef.slot.includes("RB") || slotDef.slot.includes("LB"))) {
    matchupBonus += 4;
  }
  if (opponentAnalysis.flags.centralVulnerable && (slotArea === "midfield" || slotDef.slot.includes("ST") || slotDef.slot.includes("CAM"))) {
    matchupBonus += 3;
  }
  if (opponentAnalysis.flags.keeperVulnerable && (slotArea === "attack" || slotDef.slot.includes("CAM"))) {
    matchupBonus += 2;
  }

  return player.adjustedScore * fit * naturalFit + trait + matchupBonus;
};

const solveFormationLineup = ({ formation, squad, opponentAnalysis }) => {
  const slots = FORMATION_SLOTS[formation];
  if (!slots) return null;
  if (!Array.isArray(squad) || squad.length < 11) return null;

  const maxCandidatesPerSlot = squad.length <= 14 ? squad.length : 6;
  const defensiveSlotsNeeded = slots.filter(slotDef => slotGroup(slotDef.slot) === "defense").length;
  const availableDefensiveProfiles = squad.filter(
    player => !isGoalkeeperProfile(player) && isDefensiveProfile(player)
  ).length;
  const enforceStrictDefense = availableDefensiveProfiles >= defensiveSlotsNeeded;

  const candidatesBySlot = slots.map(slotDef => {
    const slotNeedsGoalkeeper = slotDef.slot === "GK";
    const eligiblePlayers = squad.filter(player =>
      slotNeedsGoalkeeper ? isGoalkeeperProfile(player) : !isGoalkeeperProfile(player)
    );
    const slotPool =
      enforceStrictDefense && slotGroup(slotDef.slot) === "defense"
        ? eligiblePlayers.filter(isDefensiveProfile)
        : eligiblePlayers;

    return slotPool
      .map(player => ({
        player,
        score: playerSlotScore({ player, slotDef, opponentAnalysis })
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidatesPerSlot);
  });

  if (candidatesBySlot.some(candidates => !candidates.length)) {
    return null;
  }

  const orderedSlotIndexes = slots
    .map((_, index) => index)
    .sort((a, b) => candidatesBySlot[a].length - candidatesBySlot[b].length);

  const maxRemaining = new Array(orderedSlotIndexes.length).fill(0);
  for (let index = orderedSlotIndexes.length - 1; index >= 0; index -= 1) {
    const slotIndex = orderedSlotIndexes[index];
    const slotMax = candidatesBySlot[slotIndex][0]?.score || 0;
    maxRemaining[index] = slotMax + (maxRemaining[index + 1] || 0);
  }

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestAssignment = null;

  const dfs = (depth, usedPlayers, runningScore, assignment) => {
    if (depth >= orderedSlotIndexes.length) {
      if (runningScore > bestScore) {
        bestScore = runningScore;
        bestAssignment = assignment.slice();
      }
      return;
    }

    if (runningScore + maxRemaining[depth] <= bestScore) return;

    const slotIndex = orderedSlotIndexes[depth];
    const candidates = candidatesBySlot[slotIndex];

    for (const candidate of candidates) {
      if (usedPlayers.has(candidate.player.id)) continue;
      usedPlayers.add(candidate.player.id);
      assignment[slotIndex] = candidate;
      dfs(depth + 1, usedPlayers, runningScore + candidate.score, assignment);
      usedPlayers.delete(candidate.player.id);
      assignment[slotIndex] = null;
    }
  };

  dfs(0, new Set(), 0, new Array(slots.length).fill(null));

  if (!bestAssignment) return null;

  const lineup = slots.map((slotDef, index) => {
    const pick = bestAssignment[index];
    const player = pick?.player || null;
    return {
      slot: slotDef.slot,
      fitScore: pick?.score ? Math.round(pick.score * 10) / 10 : null,
      playerDocId: player?.id || null,
      playerID: player?.playerID || null,
      name: player?.name || "Unavailable",
      role: player?.role || "GENERIC",
      confidence: player?.confidence ?? 0,
      seasonScore: player?.baseScore ?? null,
      strengths: Array.isArray(player?.strengths) ? player.strengths : []
    };
  });

  const tacticalBonus = tacticalFormationBonus({ formation, opponentAnalysis });
  const finalScore = bestScore + tacticalBonus;

  return {
    formation,
    tacticalBonus: Math.round(tacticalBonus * 10) / 10,
    lineup,
    baseLineupScore: Math.round(bestScore * 10) / 10,
    finalScore: Math.round(finalScore * 10) / 10
  };
};

const buildAiPlannerPrompt = ({
  teamName,
  opponentTeamName,
  opponentAnalysis,
  opponentLineup,
  ownSquad,
  preferredFormation,
  matchVenue = "home"
}) => {
  const allowedFormations = Object.keys(FORMATION_SLOTS);
  const ownSquadView = ownSquad.map(player => ({
    playerDocId: player.id,
    name: player.name,
    role: player.role,
    naturalPosition: player.position || null,
    score: player.adjustedScore,
    confidence: player.confidence,
    strengths: player.strengths || []
  }));
  const opponentView = opponentLineup.map(player => ({
    name: player.name || null,
    position: player.position,
    role: player.role,
    quality: player.knownQuality ?? null
  }));

  return `
Return ONLY valid JSON in this schema:
{
  "formation": ${JSON.stringify(allowedFormations)},
  "startingPlayerDocIds": [string, string, string, string, string, string, string, string, string, string, string],
  "outcomeProbabilities": {
    "ownWinChancePct": number,
    "drawChancePct": number,
    "opponentWinChancePct": number
  },
  "advice": {
    "keyWeaknesses": [string],
    "attackingPlan": [string],
    "pressingTriggers": [string],
    "cautionPoints": [string],
    "matchupNotes": [string]
  }
}

Context:
- My team: ${teamName || "Unknown team"}
- Preferred formation: ${preferredFormation || "none specified"}
- Match venue: ${matchVenue === "away" ? "Away" : "Home"}
- Opponent: ${opponentTeamName || "Unknown opponent"}
- Opponent predicted formation: ${opponentAnalysis.formation}
- Opponent weak zones: ${(opponentAnalysis.weakZones || []).join(", ") || "none detected"}
- Opponent structure flags: ${JSON.stringify(opponentAnalysis.flags)}

Predicted opponent lineup (with inferred role):
${JSON.stringify(opponentView, null, 2)}

My available squad (choose ONLY from playerDocId in this list):
${JSON.stringify(ownSquadView, null, 2)}

Selection rules:
- Choose exactly 11 UNIQUE playerDocId values from the provided squad list.
- If a preferred formation is provided, use that formation.
- Keep exactly one goalkeeper and place the goalkeeper only in GK.
- Prioritize players in their natural positions, especially defensive slots.
- Use role balance for the selected formation.
- Prefer higher score players, but allow tactical exceptions if justified by opponent weaknesses.
- Estimate outcome probabilities realistically as integers.
- outcomeProbabilities.ownWinChancePct + drawChancePct + opponentWinChancePct must equal 100.
- Apply venue context: home allows slightly more proactive assumptions; away requires more risk management.
- Do not invent players or ids.
- Advice must be actionable and concise (football tactical language).
- Keep advice arrays with 2 to 6 short items each.
`.trim();
};

const normalizeAiWinChance = value => {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  return Math.round(clamp(parsed, 5, 95));
};

const normalizeAiOutcomeProbabilities = value => {
  if (!value || typeof value !== "object") return null;
  const ownRaw = toNumber(value.ownWinChancePct);
  const drawRaw = toNumber(value.drawChancePct);
  const opponentRaw = toNumber(value.opponentWinChancePct);
  if (ownRaw == null || drawRaw == null || opponentRaw == null) return null;

  const own = clamp(ownRaw, 0, 100);
  const draw = clamp(drawRaw, 0, 100);
  const opponent = clamp(opponentRaw, 0, 100);
  const total = own + draw + opponent;
  if (total <= 0) return null;

  const ownNorm = Math.round((own / total) * 100);
  const drawNorm = Math.round((draw / total) * 100);
  const opponentNorm = Math.max(0, 100 - ownNorm - drawNorm);

  return {
    ownWinChancePct: ownNorm,
    drawChancePct: drawNorm,
    opponentWinChancePct: opponentNorm
  };
};

const normalizeAiAdvice = value => {
  if (!value || typeof value !== "object") return null;
  const advice = {
    keyWeaknesses: normalizeStringList(value.keyWeaknesses, { max: 5, fallback: [] }),
    attackingPlan: normalizeStringList(value.attackingPlan, { max: 6, fallback: [] }),
    pressingTriggers: normalizeStringList(value.pressingTriggers, { max: 4, fallback: [] }),
    cautionPoints: normalizeStringList(value.cautionPoints, { max: 4, fallback: [] }),
    matchupNotes: normalizeStringList(value.matchupNotes, { max: 4, fallback: [] })
  };

  const totalItems =
    advice.keyWeaknesses.length +
    advice.attackingPlan.length +
    advice.pressingTriggers.length +
    advice.cautionPoints.length +
    advice.matchupNotes.length;

  return totalItems ? advice : null;
};

const validateAiSelection = ({ payload, squadProfiles, preferredFormation = null }) => {
  const formation = normalizeFormation(payload?.formation);
  if (!formation || !FORMATION_SLOTS[formation]) {
    return null;
  }
  if (preferredFormation && formation !== preferredFormation) {
    return null;
  }

  const idsRaw = Array.isArray(payload?.startingPlayerDocIds) ? payload.startingPlayerDocIds : [];
  const ids = idsRaw
    .map(value => String(value || "").trim())
    .filter(Boolean);

  const uniqueIds = [];
  const seen = new Set();
  ids.forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    uniqueIds.push(id);
  });

  if (uniqueIds.length !== 11) {
    return null;
  }

  const squadById = new Map(squadProfiles.map(player => [player.id, player]));
  const selectedPlayers = uniqueIds.map(id => squadById.get(id)).filter(Boolean);
  if (selectedPlayers.length !== 11) {
    return null;
  }

  const outcomeProbabilities =
    normalizeAiOutcomeProbabilities(payload?.outcomeProbabilities) ||
    normalizeAiOutcomeProbabilities({
      ownWinChancePct: payload?.ownWinChancePct,
      drawChancePct: payload?.drawChancePct,
      opponentWinChancePct: payload?.opponentWinChancePct
    });

  return {
    formation,
    selectedPlayers,
    winChancePct: normalizeAiWinChance(payload?.winChancePct),
    outcomeProbabilities,
    advice: normalizeAiAdvice(payload?.advice)
  };
};

const buildAiRecommendation = async ({
  teamName,
  opponentTeamName,
  opponentAnalysis,
  opponentLineup,
  ownSquad,
  preferredFormation = null,
  matchVenue = "home"
}) => {
  const client = getOpenAI();
  if (!client) {
    return {
      recommendation: null,
      advice: null,
      winChancePct: null,
      outcomeProbabilities: null,
      reason: "openai_not_configured"
    };
  }

  const prompt = buildAiPlannerPrompt({
    teamName,
    opponentTeamName,
    opponentAnalysis,
    opponentLineup,
    ownSquad,
    preferredFormation,
    matchVenue
  });

  try {
    const response = await client.chat.completions.create({
      model: TACTICAL_AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an elite football tactical analyst. Produce valid JSON only and obey the provided player list."
        },
        { role: "user", content: prompt }
      ],
      temperature: TACTICAL_AI_TEMPERATURE
    });

    const raw = response?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = parseAiJson(raw);
    if (!parsed) {
      return {
        recommendation: null,
        advice: null,
        winChancePct: null,
        outcomeProbabilities: null,
        reason: "ai_invalid_json"
      };
    }

    const validated = validateAiSelection({
      payload: parsed,
      squadProfiles: ownSquad,
      preferredFormation
    });
    if (!validated) {
      return {
        recommendation: null,
        advice: null,
        winChancePct: null,
        outcomeProbabilities: null,
        reason: "ai_invalid_selection"
      };
    }

    const recommendation = solveFormationLineup({
      formation: validated.formation,
      squad: validated.selectedPlayers,
      opponentAnalysis
    });

    if (!recommendation) {
      return {
        recommendation: null,
        advice: null,
        winChancePct: null,
        outcomeProbabilities: null,
        reason: "ai_unassignable_selection"
      };
    }

    return {
      recommendation,
      winChancePct: validated.winChancePct,
      outcomeProbabilities: validated.outcomeProbabilities,
      advice: validated.advice || null,
      reason: null
    };
  } catch (error) {
    return {
      recommendation: null,
      advice: null,
      winChancePct: null,
      outcomeProbabilities: null,
      reason: error?.message || "ai_request_failed"
    };
  }
};

const buildAdvice = ({ recommendation, opponentAnalysis }) => {
  const attackingPlan = [];
  const pressingTriggers = [];
  const cautionPoints = [];

  if (opponentAnalysis.flags.flankVulnerable) {
    attackingPlan.push("Attack wide channels early with diagonal passes before their shape resets.");
    attackingPlan.push("Create 2v1 overloads on the flanks using winger + overlapping full-back.");
    pressingTriggers.push("Press immediately when their full-back or wing-back receives facing own goal.");
  }

  if (opponentAnalysis.flags.centralVulnerable) {
    attackingPlan.push("Occupy half-spaces with your attacking midfielder and third-man combinations.");
    attackingPlan.push("Play vertical passes through their single pivot to reach the striker quickly.");
    pressingTriggers.push("Jump on their pivot after backward passes from center-backs.");
  }

  if (opponentAnalysis.flags.keeperVulnerable) {
    attackingPlan.push("Increase shots from zone 14 and attack second balls around the goalkeeper.");
    pressingTriggers.push("Force long clearances by pressing their goalkeeper on short build-up.");
  }

  if (!attackingPlan.length) {
    attackingPlan.push("Use positional rotations between midfield and front line to unbalance marking references.");
  }

  const weakLinks = opponentAnalysis.lowQualityEntries.slice(0, 3);
  weakLinks.forEach(entry => {
    const playerName = entry.name || entry.matchedPlayerName || `their ${entry.position}`;
    attackingPlan.push(`Isolate ${playerName} in direct duels and attack that zone repeatedly.`);
  });

  if (opponentAnalysis.flags.hasTwoStrikers) {
    cautionPoints.push("Keep rest-defense compact; avoid sending both full-backs high at once.");
  }
  if (opponentAnalysis.flags.highWingbackRisk) {
    cautionPoints.push("Protect transitions after losing the ball because wing-back systems counter quickly.");
  }
  if (opponentAnalysis.counts.attackers >= 3) {
    cautionPoints.push("Track far-side runs from wingers to prevent overloads at the back post.");
  }
  if (!cautionPoints.length) {
    cautionPoints.push("Maintain at least two players behind the ball during sustained attacks.");
  }

  const focusPlayers = recommendation.lineup
    .filter(entry => ["RW", "LW", "ST", "CAM", "RM", "LM", "RST", "LST"].includes(entry.slot))
    .slice(0, 3)
    .map(entry => entry.name)
    .filter(Boolean);

  const matchupNotes = focusPlayers.length
    ? [`Build your attacking plan around ${focusPlayers.join(", ")} in high-value zones.`]
    : ["Use your highest-rated attackers to target the opponent's weakest defensive side."];

  return {
    keyWeaknesses: [
      ...opponentAnalysis.structuralWeaknesses,
      ...opponentAnalysis.lowQualityEntries.slice(0, 3).map(entry => {
        const label = entry.name || entry.matchedPlayerName || entry.position;
        return `${label}: defensive reliability below average.`;
      })
    ].slice(0, 5),
    attackingPlan: attackingPlan.slice(0, 6),
    pressingTriggers: pressingTriggers.slice(0, 4),
    cautionPoints: cautionPoints.slice(0, 4),
    matchupNotes
  };
};

const estimateWinChancePct = ({ recommendation, opponentLineup }) => {
  const lineupScores = Array.isArray(recommendation?.lineup)
    ? recommendation.lineup
        .map(entry => toNumber(entry?.seasonScore))
        .filter(value => value != null)
    : [];
  const ownAverageScore = lineupScores.length
    ? lineupScores.reduce((sum, value) => sum + value, 0) / lineupScores.length
    : 60;

  const knownOpponentScores = Array.isArray(opponentLineup)
    ? opponentLineup
        .map(entry => toNumber(entry?.knownQuality))
        .filter(value => value != null)
    : [];
  const opponentKnownCount = knownOpponentScores.length;
  const opponentKnownSum = knownOpponentScores.reduce((sum, value) => sum + value, 0);
  const opponentFallbackCount = Math.max(0, 11 - opponentKnownCount);
  const opponentAverageScore = (opponentKnownSum + opponentFallbackCount * 60) / 11;

  const tacticalBonus = toNumber(recommendation?.tacticalBonus) || 0;
  const scoreGap = ownAverageScore - opponentAverageScore;
  const rawChance = 50 + scoreGap * 1.4 + tacticalBonus * 1.2;

  // If opponent lineup quality is mostly unknown, keep the estimate closer to neutral.
  const knowledgeWeight = clamp(opponentKnownCount / 11, 0, 1);
  const confidenceWeight = 0.6 + knowledgeWeight * 0.4;
  const adjustedChance = 50 + (rawChance - 50) * confidenceWeight;

  return Math.round(clamp(adjustedChance, 5, 95));
};

const buildOutcomeProbabilities = ownWinChanceInput => {
  const ownWinChancePct = Math.round(clamp(toNumber(ownWinChanceInput) ?? 50, 5, 95));

  // Draw probability peaks around balanced matchups and drops for one-sided projections.
  const balance = 1 - Math.min(1, Math.abs(ownWinChancePct - 50) / 45);
  let drawChancePct = Math.round(12 + balance * 20); // 12..32 baseline
  drawChancePct = clamp(drawChancePct, 0, 34);
  drawChancePct = Math.min(drawChancePct, Math.max(0, 100 - ownWinChancePct - 5));

  let opponentWinChancePct = 100 - ownWinChancePct - drawChancePct;
  if (opponentWinChancePct < 0) {
    drawChancePct = Math.max(0, drawChancePct + opponentWinChancePct);
    opponentWinChancePct = 0;
  }

  // Keep percentages integer and summing to 100.
  const total = ownWinChancePct + drawChancePct + opponentWinChancePct;
  if (total !== 100) {
    opponentWinChancePct += 100 - total;
  }

  return {
    ownWinChancePct: Math.round(ownWinChancePct),
    drawChancePct: Math.round(drawChancePct),
    opponentWinChancePct: Math.round(opponentWinChancePct)
  };
};

const parseRequestPayload = payload => {
  const teamName = String(payload?.teamName || "").trim();
  const opponentTeamName = String(payload?.opponentTeamName || "").trim();
  const teamId = payload?.teamId ?? null;
  const preferredFormation = normalizeFormation(payload?.preferredFormation);
  const matchVenue = normalizeMatchVenue(payload?.matchVenue) || "home";
  const unavailablePlayerDocIds = Array.isArray(payload?.unavailablePlayerDocIds)
    ? Array.from(
        new Set(
          payload.unavailablePlayerDocIds
            .map(value => String(value || "").trim())
            .filter(Boolean)
        )
      )
    : [];

  if (!teamName && teamId == null) {
    const error = new Error("teamName or teamId is required.");
    error.status = 400;
    throw error;
  }

  const { formation, lineup } = normalizeOpponentLineup({
    opponentLineup: payload?.opponentLineup,
    opponentFormation: payload?.opponentFormation
  });

  return {
    teamName,
    teamId,
    preferredFormation: preferredFormation || null,
    matchVenue,
    opponentTeamName: opponentTeamName || null,
    opponentFormation: formation,
    opponentLineup: lineup,
    unavailablePlayerDocIds
  };
};

export async function generateTacticalPlan(payload = {}) {
  const parsed = parseRequestPayload(payload);

  const rawSquadPlayers = await fetchTeamPlayers({
    teamName: parsed.teamName,
    teamId: parsed.teamId
  });

  const unavailableIds = new Set(parsed.unavailablePlayerDocIds || []);
  const squadPlayers = rawSquadPlayers.filter(player => !unavailableIds.has(player.id));

  if (!squadPlayers.length) {
    const error = new Error("No players found for your team. Please verify teamName/teamId.");
    error.status = 404;
    throw error;
  }

  const squadProfiles = await Promise.all(squadPlayers.map(buildPlayerProfile));
  const usableProfiles = squadProfiles.sort((a, b) => b.adjustedScore - a.adjustedScore);

  if (usableProfiles.length < 11) {
    const error = new Error("At least 11 available squad players are required to build a lineup.");
    error.status = 400;
    throw error;
  }

  const availableGoalkeepers = usableProfiles.filter(profile => isGoalkeeperProfile(profile));
  const availableOutfieldPlayers = usableProfiles.length - availableGoalkeepers.length;
  if (!availableGoalkeepers.length) {
    const error = new Error("At least one available goalkeeper is required.");
    error.status = 400;
    throw error;
  }
  if (availableOutfieldPlayers < 10) {
    const error = new Error("At least 10 available outfield players are required.");
    error.status = 400;
    throw error;
  }

  const enrichedOpponentLineup = await enrichOpponentWithKnownData({
    lineup: parsed.opponentLineup,
    opponentTeamName: parsed.opponentTeamName
  });

  const opponentAnalysis = analyzeOpponent({
    formation: parsed.opponentFormation,
    lineup: enrichedOpponentLineup
  });

  const formationCandidates = Object.keys(FORMATION_SLOTS)
    .map(formation =>
      solveFormationLineup({
        formation,
        squad: usableProfiles,
        opponentAnalysis
      })
    )
    .filter(Boolean)
    .sort((a, b) => b.finalScore - a.finalScore);

  if (!formationCandidates.length) {
    const error = new Error("Could not compute a valid lineup for the available squad.");
    error.status = 500;
    throw error;
  }

  const preferredFormationRecommendation = parsed.preferredFormation
    ? solveFormationLineup({
        formation: parsed.preferredFormation,
        squad: usableProfiles,
        opponentAnalysis
      })
    : null;

  const deterministicRecommendation =
    preferredFormationRecommendation || formationCandidates[0];
  const aiResult = await buildAiRecommendation({
    teamName: parsed.teamName || usableProfiles[0]?.teamName || null,
    opponentTeamName: parsed.opponentTeamName,
    opponentAnalysis,
    opponentLineup: enrichedOpponentLineup,
    ownSquad: usableProfiles,
    preferredFormation: parsed.preferredFormation,
    matchVenue: parsed.matchVenue
  });

  if (aiResult?.reason && aiResult.reason !== "openai_not_configured") {
    console.warn("[tacticalPlanner] AI selection fallback:", aiResult.reason);
  }

  const recommendation = aiResult?.recommendation || deterministicRecommendation;
  const squadProfilesByDocId = new Map(usableProfiles.map(player => [player.id, player]));
  const chosenPlayerIds = new Set(
    recommendation.lineup
      .map(entry => entry.playerDocId)
      .filter(Boolean)
  );

  const bench = usableProfiles
    .filter(player => !chosenPlayerIds.has(player.id))
    .slice(0, 7)
    .map(player => ({
      playerDocId: player.id,
      playerID: player.playerID,
      name: player.name,
      role: player.role,
      score: player.adjustedScore
    }));

  const deterministicAdvice = buildAdvice({ recommendation, opponentAnalysis });
  const deterministicWinChancePct = estimateWinChancePct({
    recommendation,
    opponentLineup: enrichedOpponentLineup
  });
  const venueAdjustedDeterministicWinChancePct = Math.round(
    clamp(deterministicWinChancePct + (parsed.matchVenue === "home" ? 4 : -4), 5, 95)
  );
  const deterministicOutcomeProbabilities = buildOutcomeProbabilities(
    venueAdjustedDeterministicWinChancePct
  );
  const outcomeProbabilities =
    aiResult?.outcomeProbabilities ||
    (aiResult?.winChancePct != null
      ? buildOutcomeProbabilities(aiResult.winChancePct)
      : deterministicOutcomeProbabilities);
  const advice = aiResult?.advice
    ? {
        keyWeaknesses:
          aiResult.advice.keyWeaknesses.length
            ? aiResult.advice.keyWeaknesses
            : deterministicAdvice.keyWeaknesses,
        attackingPlan:
          aiResult.advice.attackingPlan.length
            ? aiResult.advice.attackingPlan
            : deterministicAdvice.attackingPlan,
        pressingTriggers:
          aiResult.advice.pressingTriggers.length
            ? aiResult.advice.pressingTriggers
            : deterministicAdvice.pressingTriggers,
        cautionPoints:
          aiResult.advice.cautionPoints.length
            ? aiResult.advice.cautionPoints
            : deterministicAdvice.cautionPoints,
        matchupNotes:
          aiResult.advice.matchupNotes.length
            ? aiResult.advice.matchupNotes
            : deterministicAdvice.matchupNotes
      }
    : deterministicAdvice;

  const formCharts = await fetchFormCharts({
    ownTeamName: parsed.teamName || usableProfiles[0]?.teamName || null,
    opponentTeamName: parsed.opponentTeamName,
    recommendation,
    squadProfilesByDocId
  });

  return {
    team: {
      name: parsed.teamName || usableProfiles[0]?.teamName || null,
      squadSize: usableProfiles.length,
      unavailableCount: unavailableIds.size,
      matchVenue: parsed.matchVenue
    },
    opponent: {
      teamName: parsed.opponentTeamName,
      formation: opponentAnalysis.formation,
      lineup: enrichedOpponentLineup,
      knownPlayers: enrichedOpponentLineup.filter(entry => entry.knownQuality != null).length
    },
    recommendation: {
      formation: recommendation.formation,
      score: recommendation.finalScore,
      winChancePct: outcomeProbabilities.ownWinChancePct,
      drawChancePct: outcomeProbabilities.drawChancePct,
      opponentWinChancePct: outcomeProbabilities.opponentWinChancePct,
      tacticalBonus: recommendation.tacticalBonus,
      lineup: recommendation.lineup,
      bench
    },
    formCharts,
    advice,
    plannerEngine: {
      mode: aiResult?.recommendation ? "ai" : "deterministic",
      model: aiResult?.recommendation ? TACTICAL_AI_MODEL : null,
      fallbackReason: aiResult?.recommendation ? null : aiResult?.reason || null
    }
  };
}
