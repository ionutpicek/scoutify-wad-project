import express from "express";
import crypto from "crypto";
import { db } from "../firebase/firebaseAdmin.js";
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const router = express.Router();

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

const upsertStatsPayload = async (mysql, playerId, payload) => {
  const statsPayload = payload || {};
  const minutes = statsPayload.minutes ?? statsPayload.minutesPlayed ?? null;
  const seasonRole =
    statsPayload.primaryRole ??
    statsPayload.roleProfile?.primaryRole ??
    statsPayload.seasonGrade?.role ??
    null;
  const seasonGradeOverall =
    statsPayload.seasonGrade?.overall10 != null
      ? Number(statsPayload.seasonGrade.overall10)
      : null;

  const [rows] = await mysql.execute(
    `SELECT id FROM stats WHERE player_id = ? LIMIT 1`,
    [playerId]
  );
  if (rows.length) {
    await mysql.execute(
      `UPDATE stats
       SET minutes = COALESCE(?, minutes),
           season_role = COALESCE(?, season_role),
           season_grade_overall = COALESCE(?, season_grade_overall),
           source_payload = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ?`,
      [
        minutes != null ? Number(minutes) : null,
        seasonRole,
        seasonGradeOverall,
        JSON.stringify(statsPayload),
        playerId
      ]
    );
    return rows[0].id;
  }

  const newId = crypto.randomUUID();
  await mysql.execute(
    `INSERT INTO stats (id, player_id, minutes, season_role, season_grade_overall, scout_snapshot, source_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      playerId,
      minutes != null ? Number(minutes) : null,
      seasonRole,
      seasonGradeOverall,
      null,
      JSON.stringify(statsPayload)
    ]
  );
  return newId;
};

router.get("/player/:playerId", async (req, res) => {
  const { playerId } = req.params || {};
  if (!playerId) {
    return res.status(400).json({ message: "playerId is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.execute(
        `SELECT id, player_id, source_payload
         FROM stats
         WHERE player_id = ?
         LIMIT 1`,
        [String(playerId)]
      );
      if (!rows.length) return res.json({ stats: null });
      const row = rows[0];
      const payload = parseSourcePayload(row.source_payload);
      return res.json({
        stats: {
          ...payload,
          playerID: row.player_id ?? payload.playerID ?? null,
          _statsDocId: row.id,
          seasonGrade: payload.seasonGrade
            ? { ...payload.seasonGrade, statsDocId: row.id }
            : payload.seasonGrade,
        },
      });
    }

    const snap = await db.collection("stats").where("playerID", "==", Number(playerId)).limit(1).get();
    if (snap.empty) return res.json({ stats: null });
    const doc = snap.docs[0];
    const data = doc.data() || {};
    return res.json({
      stats: {
        ...data,
        _statsDocId: doc.id,
        seasonGrade: data.seasonGrade ? { ...data.seasonGrade, statsDocId: doc.id } : data.seasonGrade,
      },
    });
  } catch (error) {
    console.error("Failed to load player stats:", error);
    return res.status(500).json({ message: "Unable to load player stats." });
  }
});

router.get("/leaderboard", async (req, res) => {
  const { stat = "goals", limit = "10" } = req.query || {};
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const safeStat = String(stat || "").trim();
  if (!/^[a-zA-Z0-9_]+$/.test(safeStat)) {
    return res.status(400).json({ message: "Invalid stat." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.query(
        `SELECT s.id AS stats_id, s.player_id, s.source_payload AS stats_payload,
                p.id AS player_doc_id, p.name, p.team_name, p.photo_url, p.source_payload AS player_payload
         FROM stats s
         INNER JOIN players p ON p.player_id = s.player_id
         ORDER BY JSON_EXTRACT(s.source_payload, ?) DESC
         LIMIT ?`,
        [`$.${safeStat}`, safeLimit]
      );

      const players = rows.map((row) => {
        const stats = parseSourcePayload(row.stats_payload);
        const playerPayload = parseSourcePayload(row.player_payload);
        return {
          id: row.player_doc_id,
          name: row.name ?? playerPayload.name ?? "Unknown",
          team: row.team_name ?? playerPayload.teamName ?? "Unknown",
          photo:
            playerPayload.photo ||
            playerPayload.photoURL ||
            playerPayload.imageUrl ||
            playerPayload.profilePhoto ||
            row.photo_url ||
            "",
          stats: {
            ...stats,
            playerID: row.player_id ?? stats.playerID ?? null,
            _statsDocId: row.stats_id,
          },
        };
      });

      return res.json({ players });
    }

    const statsSnap = await db
      .collection("stats")
      .orderBy(stat, "desc")
      .limit(safeLimit)
      .get();

    const playerIds = statsSnap.docs.map((doc) => doc.data()?.playerID).filter(Boolean);
    if (!playerIds.length) return res.json({ players: [] });

    const playersQuery = await db
      .collection("player")
      .where("playerID", "in", playerIds.slice(0, 10))
      .get();
    const playerMap = new Map();
    playersQuery.docs.forEach((doc) => {
      const data = doc.data() || {};
      playerMap.set(data.playerID ?? doc.id, { id: doc.id, ...data });
    });

    const players = statsSnap.docs.map((doc) => {
      const data = doc.data() || {};
      const key = data.playerID ?? doc.id;
      const playerDoc = playerMap.get(key) || {};
      return {
        id: playerDoc.id ?? key,
        name: playerDoc.name || "Unknown",
        team: playerDoc.teamName || playerDoc.team || "Unknown",
        photo: playerDoc.photo || playerDoc.photoURL || "",
        stats: data,
      };
    });

    return res.json({ players });
  } catch (error) {
    console.error("Failed to load leaderboard:", error);
    return res.status(500).json({ message: "Unable to load leaderboard." });
  }
});

router.post("/upsert", async (req, res) => {
  const { playerId, stats } = req.body || {};
  if (!playerId || !stats) {
    return res.status(400).json({ message: "playerId and stats are required." });
  }
  if (!shouldUseMysql()) {
    return res.status(500).json({ message: "MySQL not configured." });
  }

  try {
    const mysql = getMysqlPool();
    const statsId = await upsertStatsPayload(mysql, String(playerId), stats);
    return res.json({ ok: true, statsId });
  } catch (error) {
    console.error("Failed to upsert stats:", error);
    return res.status(500).json({ message: "Unable to update stats." });
  }
});

router.post("/increment", async (req, res) => {
  const { increments } = req.body || {};
  if (!Array.isArray(increments) || !increments.length) {
    return res.status(400).json({ message: "increments array is required." });
  }
  if (!shouldUseMysql()) {
    return res.status(500).json({ message: "MySQL not configured." });
  }

  try {
    const mysql = getMysqlPool();
    for (const entry of increments) {
      const playerId = entry?.playerId;
      const deltas = entry?.deltas || {};
      if (!playerId || !Object.keys(deltas).length) continue;

      const [rows] = await mysql.execute(
        `SELECT id, source_payload FROM stats WHERE player_id = ? LIMIT 1`,
        [String(playerId)]
      );

      let payload = {};
      let statsId = null;
      if (rows.length) {
        payload = parseSourcePayload(rows[0].source_payload);
        statsId = rows[0].id;
      }

      Object.entries(deltas).forEach(([key, value]) => {
        const current = Number(payload[key] || 0);
        const delta = Number(value || 0);
        payload[key] = Math.round((current + delta) * 100) / 100;
      });

      if (statsId) {
        await mysql.execute(
          `UPDATE stats
           SET source_payload = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [JSON.stringify(payload), statsId]
        );
      } else {
        const newId = crypto.randomUUID();
        payload.playerID = payload.playerID ?? Number(playerId);
        await mysql.execute(
          `INSERT INTO stats (id, player_id, minutes, season_role, season_grade_overall, scout_snapshot, source_payload)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId, String(playerId), null, null, null, null, JSON.stringify(payload)]
        );
      }
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to increment stats:", error);
    return res.status(500).json({ message: "Unable to increment stats." });
  }
});

export default router;
