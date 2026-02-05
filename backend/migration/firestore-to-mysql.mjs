import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { db } from "../src/firebase/firebaseAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SCHEMA = path.join(__dirname, "schema.mysql.sql");

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    runSchema: false,
    schemaPath: DEFAULT_SCHEMA,
  };

  for (const arg of args) {
    if (arg === "--run-schema") out.runSchema = true;
    if (arg.startsWith("--schema=")) out.schemaPath = path.resolve(process.cwd(), arg.split("=")[1]);
  }
  return out;
};

const loadMysql = async () => {
  try {
    const mod = await import("mysql2/promise");
    return mod.default ?? mod;
  } catch (error) {
    throw new Error("mysql2 is required. Run: npm i mysql2");
  }
};

const mysqlConfig = () => ({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: true,
});

const must = (value, name) => {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
};

const normalizeValue = (value) => {
  if (value == null) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeValue(v);
    return out;
  }
  return value;
};

const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const iso = value.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  return null;
};

const toBigIntNumber = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const splitSqlStatements = (sqlText) =>
  sqlText
    .split(/;\s*(?:\r?\n|$)/g)
    .map((s) => s.trim())
    .filter(Boolean);

const runSchemaIfNeeded = async (conn, schemaPath, enabled) => {
  if (!enabled) return;
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  const statements = splitSqlStatements(schemaSql);
  for (const statement of statements) {
    await conn.query(statement);
  }
  console.log(`[schema] applied ${statements.length} statements from ${schemaPath}`);
};

const upsert = async (conn, table, row) => {
  const cols = Object.keys(row);
  const vals = cols.map((k) => row[k]);
  const placeholders = cols.map(() => "?").join(", ");
  const updates = cols
    .filter((c) => c !== "id" && c !== "uid")
    .map((c) => `${c}=VALUES(${c})`)
    .join(", ");

  const sql = `
    INSERT INTO ${table} (${cols.join(", ")})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates || `${cols[0]}=${cols[0]}`}
  `;
  await conn.execute(sql, vals);
};

const migrateCollection = async ({ conn, collectionName, mapper, tableName }) => {
  const snap = await db.collection(collectionName).get();
  let processed = 0;

  for (const doc of snap.docs) {
    const payload = normalizeValue(doc.data() || {});
    const row = mapper(doc.id, payload);
    await upsert(conn, tableName, row);
    processed += 1;
  }

  console.log(`[migrate] ${collectionName} -> ${tableName}: ${processed} rows`);
};

const mappers = {
  team: {
    tableName: "teams",
    mapper: (id, payload) => ({
      id,
      team_id: payload.teamID != null ? String(payload.teamID) : null,
      name: payload.name ?? null,
      slug: payload.slug ?? null,
      coach: payload.coach ?? payload.coachName ?? null,
      coach_url: payload.coachURL ?? payload.coachUrl ?? null,
      source_payload: JSON.stringify(payload),
    }),
  },
  player: {
    tableName: "players",
    mapper: (id, payload) => ({
      id,
      player_id: toBigIntNumber(payload.playerID),
      team_id: payload.teamID != null ? String(payload.teamID) : null,
      team_name: payload.teamName ?? null,
      name: payload.name ?? null,
      abbr_name: payload.abbrName ?? null,
      position: payload.position ?? null,
      nationality: payload.nationality ?? null,
      birthdate: toDateOnly(payload.birthdate),
      photo_url: payload.photoURL ?? payload.photoUrl ?? null,
      source_payload: JSON.stringify(payload),
    }),
  },
  stats: {
    tableName: "stats",
    mapper: (id, payload) => ({
      id,
      player_id: toBigIntNumber(payload.playerID),
      minutes: payload.minutes != null ? Number(payload.minutes) : null,
      season_role: payload?.seasonGrade?.role ?? null,
      season_grade_overall:
        payload?.seasonGrade?.overall10 != null ? Number(payload.seasonGrade.overall10) : null,
      scout_snapshot: payload?.seasonGrade?.scoutSnapshot ?? null,
      source_payload: JSON.stringify(payload),
    }),
  },
  matches: {
    tableName: "matches",
    mapper: (id, payload) => ({
      id,
      match_date: payload.date ?? null,
      round_no: payload.round != null ? Number(payload.round) : null,
      home_team_id: payload.homeTeamId != null ? String(payload.homeTeamId) : null,
      away_team_id: payload.awayTeamId != null ? String(payload.awayTeamId) : null,
      home_team: payload.homeTeam ?? null,
      away_team: payload.awayTeam ?? null,
      score: payload.score ?? null,
      home_goals: payload.homeGoals != null ? Number(payload.homeGoals) : null,
      away_goals: payload.awayGoals != null ? Number(payload.awayGoals) : null,
      team_stats: payload.teamStats ? JSON.stringify(payload.teamStats) : null,
      gps_metrics: payload.gpsMetrics ? JSON.stringify(payload.gpsMetrics) : null,
      best_performers: payload.bestPerformers ? JSON.stringify(payload.bestPerformers) : null,
      players_json: payload.players ? JSON.stringify(payload.players) : null,
      source_payload: JSON.stringify(payload),
    }),
  },
  users: {
    tableName: "app_users",
    mapper: (uid, payload) => ({
      uid,
      email: payload.email ?? null,
      username: payload.username ?? null,
      full_name: payload.fullName ?? null,
      role_name: payload.role ?? null,
      team_name: payload.teamName ?? null,
      verify_user: payload.verifyUser != null ? (payload.verifyUser ? 1 : 0) : null,
      player_doc_id: payload.playerDocId ?? null,
      player_id: toBigIntNumber(payload.playerID),
      matched_player_name: payload.matchedPlayerName ?? null,
      source_payload: JSON.stringify(payload),
    }),
  },
};

const main = async () => {
  const args = parseArgs();
  const mysql = await loadMysql();
  must(process.env.MYSQL_HOST, "MYSQL_HOST");
  must(process.env.MYSQL_USER, "MYSQL_USER");
  must(process.env.MYSQL_DATABASE, "MYSQL_DATABASE");

  const conn = await mysql.createConnection(mysqlConfig());

  try {
    await runSchemaIfNeeded(conn, args.schemaPath, args.runSchema);

    await conn.beginTransaction();
    await migrateCollection({ conn, collectionName: "team", ...mappers.team });
    await migrateCollection({ conn, collectionName: "player", ...mappers.player });
    await migrateCollection({ conn, collectionName: "stats", ...mappers.stats });
    await migrateCollection({ conn, collectionName: "matches", ...mappers.matches });
    await migrateCollection({ conn, collectionName: "users", ...mappers.users });
    await conn.commit();

    console.log("[done] migration completed");
  } catch (error) {
    await conn.rollback();
    console.error("[error] migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
};

main();
