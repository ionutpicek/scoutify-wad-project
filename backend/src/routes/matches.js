import express from "express";
import multer from "multer";
import { db } from "../firebase/firebaseAdmin.js";
import { importMatchFromPdf } from "../matchesPdf/importMatchFromPDF.js";
import { parseExcelMetrics } from "../gpsMetrics/parseExcel.js";
import { buildExcelHighlights } from "../gpsMetrics/buildHighlights.js";
import { gradeGame } from "../grading/gameGrade.js";
import { gradeGameGK } from "../grading/gradeGK.js";
import { pickBestPerformers } from "../grading/pickBestPerformer.js";
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const MATCHES_COL = "matches";
const DEFAULT_LIMIT = 200;
const MIN_MINUTES_FOR_GRADE_OUTFIELD = 30;
const MIN_MINUTES_FOR_GRADE_GK = 45;
const shouldUseMysql = () => isMysqlConfigured();

function handleFirestoreError(res, err, context = "") {
  const isQuota = err?.code === 8 || /quota|exhausted/i.test(err?.message || "");
  console.error("[matches]", context, err);
  return res.status(isQuota ? 503 : 500).json({
    error: isQuota ? "Firestore quota exceeded, try again in a minute" : "Failed to fetch matches"
  });
}

function regradePlayers(players = []) {
  if (!Array.isArray(players)) return [];

  return players.map(player => {
    const rolePlayed =
      player?.rolePlayed ||
      (String(player?.position || "").toUpperCase() === "GK" ? "GK" : "GENERIC");
    const minutesPlayed = Number(player?.minutesPlayed || 0);
    const isGK = rolePlayed === "GK";
    const hasStats = player?.matchStats && Object.keys(player.matchStats).length > 0;
    const minRequired = isGK ? MIN_MINUTES_FOR_GRADE_GK : MIN_MINUTES_FOR_GRADE_OUTFIELD;

    let gameGrade = null;
    if (hasStats && minutesPlayed >= minRequired) {
      gameGrade = isGK
        ? gradeGameGK({ derived: player?.derived || {} })
        : gradeGame({
            role: rolePlayed,
            rawStats: player?.matchStats || {},
            minutes: minutesPlayed
          });
    }

    const seasonGrade = player?.seasonGradeSnapshot?.overall10 ?? player?.seasonGrade ?? null;
    const delta =
      seasonGrade != null && gameGrade?.overall10 != null
        ? Math.round((Number(gameGrade.overall10) - Number(seasonGrade)) * 10) / 10
        : null;

    return {
      ...player,
      rolePlayed,
      gameGrade,
      grade: gameGrade?.overall10 ?? null,
      delta
    };
  });
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toMatchRow(matchId, data) {
  return {
    id: matchId,
    match_date: data.date ?? null,
    round_no: data.round != null ? Number(data.round) : null,
    home_team_id: data.homeTeamId != null ? String(data.homeTeamId) : null,
    away_team_id: data.awayTeamId != null ? String(data.awayTeamId) : null,
    home_team: data.homeTeam ?? null,
    away_team: data.awayTeam ?? null,
    score: data.score ?? null,
    home_goals: data.homeGoals != null ? Number(data.homeGoals) : null,
    away_goals: data.awayGoals != null ? Number(data.awayGoals) : null,
    team_stats: data.teamStats ? JSON.stringify(data.teamStats) : null,
    gps_metrics: data.gpsMetrics ? JSON.stringify(data.gpsMetrics) : null,
    best_performers: data.bestPerformers ? JSON.stringify(data.bestPerformers) : null,
    players_json: data.players ? JSON.stringify(data.players) : null,
    source_payload: JSON.stringify({ id: matchId, ...data })
  };
}

async function upsertMatch(mysql, matchId, data) {
  const row = toMatchRow(matchId, data);
  await mysql.execute(
    `INSERT INTO matches (
      id, match_date, round_no, home_team_id, away_team_id, home_team, away_team,
      score, home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json, source_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      match_date = VALUES(match_date),
      round_no = VALUES(round_no),
      home_team_id = VALUES(home_team_id),
      away_team_id = VALUES(away_team_id),
      home_team = VALUES(home_team),
      away_team = VALUES(away_team),
      score = VALUES(score),
      home_goals = VALUES(home_goals),
      away_goals = VALUES(away_goals),
      team_stats = VALUES(team_stats),
      gps_metrics = VALUES(gps_metrics),
      best_performers = VALUES(best_performers),
      players_json = VALUES(players_json),
      source_payload = VALUES(source_payload),
      updated_at = CURRENT_TIMESTAMP`,
    [
      row.id,
      row.match_date,
      row.round_no,
      row.home_team_id,
      row.away_team_id,
      row.home_team,
      row.away_team,
      row.score,
      row.home_goals,
      row.away_goals,
      row.team_stats,
      row.gps_metrics,
      row.best_performers,
      row.players_json,
      row.source_payload
    ]
  );
}

// GET ALL MATCHES
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), 500);
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.query(
        `SELECT id, match_date, round_no, home_team, away_team, score, home_team_id, away_team_id, players_json
         FROM matches
         ORDER BY match_date DESC
         LIMIT ?`,
        [limit]
      );

      const matches = rows.map(row => {
        const players = parseJsonField(row.players_json, []);
        const uniq = new Map();
        for (const p of players || []) {
          const pid = p.playerId || `${p.teamId || ""}-${p.name || ""}`;
          const mins = Number(p.minutesPlayed || 0);
          if (mins > 0 && !uniq.has(pid)) uniq.set(pid, true);
        }

        return {
          id: row.id,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
          date: row.match_date,
          round: row.round_no ?? null,
          score: row.score,
          playersCount: uniq.size,
          players,
          homeTeamId: row.home_team_id,
          awayTeamId: row.away_team_id
        };
      });

      return res.json(matches);
    }

    const snap = await db
      .collection(MATCHES_COL)
      .orderBy("date", "desc")
      .limit(limit)
      .get();

    const matches = snap.docs.map(d => {
      const data = d.data();
      const players = Array.isArray(data.players) ? data.players : [];
      const uniq = new Map();
      for (const p of players) {
        const pid = p.playerId || `${p.teamId || ""}-${p.name || ""}`;
        const mins = Number(p.minutesPlayed || 0);
        if (mins > 0 && !uniq.has(pid)) uniq.set(pid, true);
      }

      return {
        id: d.id,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        date: data.date,
        round: data.round ?? null,
        score: data.score,
        playersCount: uniq.size,
        players,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId
      };
    });

    return res.json(matches);
  } catch (err) {
    return handleFirestoreError(res, err, "list");
  }
});

// GET ONE MATCH
router.get("/:id", async (req, res) => {
  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.execute(
        `SELECT id, match_date, round_no, home_team, away_team, score, home_team_id, away_team_id,
                home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json
         FROM matches
         WHERE id = ?
         LIMIT 1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: "Match not found" });
      const row = rows[0];
      const data = {
        date: row.match_date,
        round: row.round_no,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        score: row.score,
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
        homeGoals: row.home_goals,
        awayGoals: row.away_goals,
        teamStats: parseJsonField(row.team_stats, null),
        gpsMetrics: parseJsonField(row.gps_metrics, null),
        bestPerformers: parseJsonField(row.best_performers, null),
        players: parseJsonField(row.players_json, [])
      };

      const players = regradePlayers(data.players || []);
      const bestPerformers = pickBestPerformers(players);

      return res.json({
        id: row.id,
        ...data,
        players,
        bestPerformers,
        bestPerformer: bestPerformers
      });
    }

    const ref = db.collection(MATCHES_COL).doc(req.params.id);
    const docSnap = await ref.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Match not found" });

    const data = docSnap.data() || {};
    const players = regradePlayers(data.players || []);
    const bestPerformers = pickBestPerformers(players);

    return res.json({
      id: docSnap.id,
      ...data,
      players,
      bestPerformers,
      bestPerformer: bestPerformers
    });
  } catch (err) {
    return handleFirestoreError(res, err, "detail");
  }
});

// UPLOAD + IMPORT PDF
router.post(
  "/import-pdf",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "metrics", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const pdfFile = req.files?.file?.[0];
      if (!pdfFile?.buffer) {
        return res.status(400).json({ error: "No file uploaded (field name must be 'file')" });
      }

      const metricsFile = req.files?.metrics?.[0];

      const matchId = await importMatchFromPdf(pdfFile.buffer, pdfFile.originalname, {
        metricsBuffer: metricsFile?.buffer || null,
        metricsFilename: metricsFile?.originalname || null
      });

      if (shouldUseMysql()) {
        const mysql = getMysqlPool();
        const [rows] = await mysql.execute(
          `SELECT id, match_date, round_no, home_team, away_team, score, home_team_id, away_team_id,
                  home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json
           FROM matches
           WHERE id = ?
           LIMIT 1`,
          [matchId]
        );
        const row = rows[0];
        const match = row
          ? {
              id: row.id,
              date: row.match_date,
              round: row.round_no,
              homeTeam: row.home_team,
              awayTeam: row.away_team,
              score: row.score,
              homeTeamId: row.home_team_id,
              awayTeamId: row.away_team_id,
              homeGoals: row.home_goals,
              awayGoals: row.away_goals,
              teamStats: parseJsonField(row.team_stats, null),
              gpsMetrics: parseJsonField(row.gps_metrics, null),
              bestPerformers: parseJsonField(row.best_performers, null),
              players: parseJsonField(row.players_json, [])
            }
          : null;

        return res.json({
          ok: true,
          matchId,
          match
        });
      }

      return res.json({ ok: true, matchId, match: null });
    } catch (err) {
      console.error("import-pdf error:", err);
      return res.status(500).json({ error: err.message || "Import failed" });
    }
  }
);

// Upload GPS metrics Excel for an existing match (optionally scoped to one side)
router.post("/:id/upload-metrics", upload.single("metrics"), async (req, res) => {
  try {
    const { id } = req.params;
    const side = req.body?.side;

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "No metrics file uploaded (field name must be 'metrics')" });
    }
    if (side && side !== "home" && side !== "away") {
      return res.status(400).json({ error: "Invalid side; use 'home' or 'away'" });
    }

    let data = null;
    let isMysql = false;
    if (shouldUseMysql()) {
      isMysql = true;
      const mysql = getMysqlPool();
      const [rows] = await mysql.execute(
        `SELECT id, match_date, round_no, home_team, away_team, score, home_team_id, away_team_id,
                home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json
         FROM matches
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: "Match not found" });
      const row = rows[0];
      data = {
        id: row.id,
        date: row.match_date,
        round: row.round_no,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        score: row.score,
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
        homeGoals: row.home_goals,
        awayGoals: row.away_goals,
        teamStats: parseJsonField(row.team_stats, null),
        gpsMetrics: parseJsonField(row.gps_metrics, null),
        bestPerformers: parseJsonField(row.best_performers, null),
        players: parseJsonField(row.players_json, [])
      };
    } else {
      const snap = await db.collection(MATCHES_COL).doc(id).get();
      if (!snap.exists) return res.status(404).json({ error: "Match not found" });
      data = snap.data() || {};
    }

    const players = Array.isArray(data.players) ? data.players : [];
    if (!players.length) return res.status(400).json({ error: "Match has no players to map metrics" });

    const metrics = parseExcelMetrics(req.file.buffer);
    if (!metrics.length) return res.status(400).json({ error: "No rows parsed from Excel" });

    const norm = str =>
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s.]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const byTeam = { home: [], away: [] };
    const gpsMap = new Map();

    for (const row of metrics) {
      const matchPlayer = players.find(p => {
        const numMatch = row.number != null && p.number != null && Number(p.number) === Number(row.number);
        const nameMatch =
          norm(p.canonicalName || p.name) === norm(row.name) ||
          norm(p.name) === norm(row.name);
        return numMatch || nameMatch;
      });

      if (matchPlayer?.team === "home" || matchPlayer?.team === "away") {
        byTeam[matchPlayer.team].push(row);
        const key = matchPlayer.playerId || `${matchPlayer.team || ""}-${norm(matchPlayer.name)}`;
        gpsMap.set(key, row);
      }
    }

    const sidesToProcess = side ? [side] : ["home", "away"];
    const highlights = {};
    for (const s of sidesToProcess) {
      const h = buildExcelHighlights(byTeam[s]);
      if (h) highlights[s] = h;
    }

    if (!Object.keys(highlights).length) {
      return res.status(400).json({ error: "No metrics matched players for the requested side(s)" });
    }

    const existingNotes = data.gpsMetrics || {};
    // Overwrite existing GPS notes for the sides we process; keep the other side if not provided
    const mergedNotes = { ...(existingNotes || {}) };
    if (side) {
      mergedNotes[side] = highlights[side] || null;
    } else {
      mergedNotes.home = highlights.home || null;
      mergedNotes.away = highlights.away || null;
    }

    const buildGps = row => {
      if (!row) return null;
      const duration = row.durationMinutes || null;
      const dist = row.totalDistance || 0;
      const kmPer90 = duration ? (dist / duration) * (90 / 1000) : null;
      const gps = {
        totalDistanceMeters: dist || null,
        durationMinutes: duration,
        kmPer90,
        topSpeedKmh: row.maxSpeed ?? null,
        avgBpm: row.avgBpm ?? null,
        sprints: row.sprints ?? null
      };
      const hasVal = Object.values(gps).some(v => v !== null);
      return hasVal ? gps : null;
    };

    const updatedPlayers = players.map(p => {
      const key = p.playerId || `${p.team || ""}-${norm(p.name)}`;
      const row = gpsMap.get(key);
      const gps = buildGps(row);
      if (!gps) return p;
      return { ...p, gps };
    });

    if (!isMysql) {
      await db.collection(MATCHES_COL).doc(id).set(
        {
          gpsMetrics: mergedNotes,
          players: updatedPlayers
        },
        { merge: true }
      );
    }

    if (isMysql) {
      const mysql = getMysqlPool();
      await mysql.execute(
        `UPDATE matches
         SET gps_metrics = ?, players_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [JSON.stringify(mergedNotes), JSON.stringify(updatedPlayers), id]
      );
    }

    return res.json({
      ok: true,
      gpsMetrics: mergedNotes,
      matched: { home: byTeam.home.length, away: byTeam.away.length }
    });
  } catch (err) {
    console.error("upload-metrics error:", err);
    return res.status(500).json({ error: err.message || "Upload failed" });
  }
});

export default router;
