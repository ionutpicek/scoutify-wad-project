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

function fixMojibake(str) {
  return String(str || "")
    .replace(/\u00c5\u00a3/g, "t")
    .replace(/\u00c5\u015f/g, "s")
    .replace(/\u00c5\u009f/g, "s")
    .replace(/\u00c8/g, "t")
    .replace(/\u00e2/g, "a")
    .replace(/\u00c4\u0083/g, "a")
    .replace(/\u00c3\u00a2/g, "a")
    .replace(/\u00c3\u00ae/g, "i")
    .replace(/\u00c4\u0082/g, "a")
    .replace(/\u00c5\u017d/g, "s")
    .replace(/\u00c5/g, "s");
}

function normalize(str) {
  const withWordBreaks = String(str || "").replace(
    /(\p{Ll})(\p{Lu})/gu,
    "$1 $2"
  );

  return fixMojibake(withWordBreaks)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TEAM_ALIASES = {
  "gloria bistrietanasaud": "gloria bistrita nasaud",
  "gloria bistritaanasaud": "gloria bistrita nasaud",
  "gloria bistrieanasaud": "gloria bistrita nasaud",
  "gloria bistri taanasaud": "gloria bistrita nasaud",
};

function applyTeamAlias(norm) {
  return TEAM_ALIASES[norm] || norm;
}

export async function resolveTeams(homeTeamName, awayTeamName) {
  if (!shouldUseMysql()) {
    throw new Error("MySQL not configured for team resolution.");
  }

  const mysql = getMysqlPool();
  const [rows] = await mysql.query(
    `SELECT id, team_id, name, slug, source_payload
     FROM teams`
  );

  const teams = rows.map(row => {
    const payload = parseSourcePayload(row.source_payload);
    const name = row.name ?? payload.name ?? null;
    const slug = row.slug ?? payload.slug ?? (name ? normalize(name) : null);
    return {
      id: row.id,
      teamID: row.team_id ?? payload.teamID ?? null,
      name,
      slug
    };
  });

  const homeNorm = applyTeamAlias(normalize(homeTeamName));
  const awayNorm = applyTeamAlias(normalize(awayTeamName));

  const normalizeLoose = value =>
    normalize(value)
      .replace(/\s+/g, "")
      .replace(/([a-z])\1+/g, "$1");

  const homeLoose = applyTeamAlias(normalizeLoose(homeTeamName));
  const awayLoose = applyTeamAlias(normalizeLoose(awayTeamName));

  const home =
    teams.find(t => t.slug === homeNorm) ||
    teams.find(
      t => normalizeLoose(t.slug) === homeLoose
    );
  const away =
    teams.find(t => t.slug === awayNorm) ||
    teams.find(
      t => normalizeLoose(t.slug) === awayLoose
    );

    console.log(homeNorm);

  if (!home || !away) {
    throw new Error(
      `Team resolution failed: ${homeTeamName} / ${awayTeamName}`
    );
  }

  return {
    homeTeamId: home.teamID ?? home.id,
    awayTeamId: away.teamID ?? away.id,
    homeTeamName: home.name || homeTeamName,
    awayTeamName: away.name || awayTeamName
  };
}
