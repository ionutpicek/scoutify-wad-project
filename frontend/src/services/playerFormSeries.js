const MAX_RECENT_POINTS = 8;

const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && Number.isFinite(value.seconds)) {
    const millis = (Number(value.seconds) * 1000) + Math.round(Number(value.nanoseconds || 0) / 1e6);
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatShortDate = (dateObj) => {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(dateObj);
  } catch {
    return dateObj.toLocaleDateString();
  }
};

const extractOpponent = (matchItem) => {
  const gameName = String(matchItem?.gameName || "").trim();
  if (!gameName) return null;
  if (gameName.toLowerCase().startsWith("vs ")) return gameName.slice(3).trim() || null;
  const vsSplit = gameName.split(/\s+vs\s+/i);
  if (vsSplit.length === 2) return vsSplit[1].trim() || gameName;
  return gameName;
};

const buildTeamLogoResolver = (teamsList = []) => {
  const byId = new Map();
  const byName = new Map();

  for (const team of Array.isArray(teamsList) ? teamsList : []) {
    const logoURL = team?.photoURL || team?.logoURL || team?.logo || null;
    if (!logoURL) continue;

    [team?.teamID, team?.id]
      .filter(value => value != null)
      .map(value => String(value))
      .forEach(id => byId.set(id, logoURL));

    [team?.name, team?.teamName]
      .map(normalizeName)
      .filter(Boolean)
      .forEach(name => byName.set(name, logoURL));
  }

  return ({ teamID, teamName }) => {
    if (teamID != null) {
      const byTeamId = byId.get(String(teamID));
      if (byTeamId) return byTeamId;
    }
    const normalizedName = normalizeName(teamName);
    if (normalizedName) return byName.get(normalizedName) || null;
    return null;
  };
};

export function buildPlayerRecentGradeSeries(matchesPlayed = [], maxPoints = MAX_RECENT_POINTS, teamsList = []) {
  const resolveTeamLogo = buildTeamLogoResolver(teamsList);
  const points = (Array.isArray(matchesPlayed) ? matchesPlayed : [])
    .map((match, index) => {
      const grade = Number(match?.grade);
      if (!Number.isFinite(grade)) return null;
      const dateObj = parseDateValue(match?.date);
      const timestamp = dateObj?.getTime?.() ?? 0;
      const opponent = extractOpponent(match);
      return {
        id: match?.id || `match-${index}-${timestamp}`,
        value: grade,
        grade,
        opponent,
        opponentTeamId: match?.opponentTeamId ?? null,
        opponentLogoURL: resolveTeamLogo({
          teamID: match?.opponentTeamId ?? null,
          teamName: opponent,
        }),
        label: formatShortDate(dateObj),
        date: dateObj ? dateObj.toISOString() : null,
        timestamp,
        gameName: match?.gameName || "",
        minutes: Number(match?.minutes) || 0,
        position: match?.position || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const tsDiff = Number(b.timestamp || 0) - Number(a.timestamp || 0);
      if (tsDiff !== 0) return tsDiff;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  return points.slice(0, Math.max(1, Number(maxPoints) || MAX_RECENT_POINTS)).reverse();
}

export function summarizePlayerGradeSeries(series = []) {
  const values = (Array.isArray(series) ? series : [])
    .map(item => Number(item?.value ?? item?.grade))
    .filter(value => Number.isFinite(value));

  if (!values.length) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;

  return {
    games: values.length,
    average: round1(total / values.length),
    latest: round1(latest),
    best: round1(Math.max(...values)),
    worst: round1(Math.min(...values)),
    deltaFromPrevious: previous == null ? null : round1(latest - previous),
  };
}
