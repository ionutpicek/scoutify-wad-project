import express from "express";
import crypto from "crypto";
import { db } from "../firebase/firebaseAdmin.js";
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const router = express.Router();

const normalizeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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

const mapMysqlTeam = (row) => {
  const payload = parseSourcePayload(row.source_payload);
  return {
    id: row.id,
    teamID: row.team_id ?? payload.teamID ?? null,
    name: row.name ?? payload.name ?? null,
    slug: row.slug ?? payload.slug ?? null,
    coach: row.coach ?? payload.coach ?? payload.coachName ?? null,
    coachURL: row.coach_url ?? payload.coachURL ?? payload.coachUrl ?? null,
    photoURL: payload.photoURL ?? payload.photoUrl ?? row.photo_url ?? null,
  };
};

const shouldUseMysql = () => isMysqlConfigured();

router.get("/", async (req, res) => {
  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.query(
        `SELECT id, team_id, name, slug, coach, coach_url, source_payload, NULL AS photo_url
         FROM teams
         ORDER BY name ASC`
      );
      return res.json(rows.map(mapMysqlTeam));
    }

    const snapshot = await db.collection("team").get();
    const teams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(teams);
  } catch (error) {
    console.error("Failed to list teams:", error);
    return res.status(500).json({ message: "Unable to load teams." });
  }
});

router.get("/:teamId", async (req, res) => {
  const { teamId } = req.params || {};
  if (!teamId) {
    return res.status(400).json({ message: "teamId is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.execute(
        `SELECT id, team_id, name, slug, coach, coach_url, source_payload, NULL AS photo_url
         FROM teams
         WHERE team_id = ?
         LIMIT 1`,
        [String(teamId)]
      );
      if (!rows.length) return res.status(404).json({ message: "Team not found." });
      return res.json({ team: mapMysqlTeam(rows[0]) });
    }

    const snap = await db.collection("team").where("teamID", "==", Number(teamId)).limit(1).get();
    if (snap.empty) return res.status(404).json({ message: "Team not found." });
    const doc = snap.docs[0];
    return res.json({ team: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Failed to fetch team:", error);
    return res.status(500).json({ message: "Unable to load team." });
  }
});

router.post("/", async (req, res) => {
  const { name, coach, coachURL, photoURL } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "name is required." });
  }

  try {
    const teamID = Date.now();
    const payload = {
      name,
      coach: coach ?? null,
      coachURL: coachURL ?? null,
      photoURL: photoURL ?? null,
      slug: normalizeSlug(name),
      teamID,
    };

    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const teamDocId = crypto.randomUUID();
      await mysql.execute(
        `INSERT INTO teams (id, team_id, name, slug, coach, coach_url, source_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           slug = VALUES(slug),
           coach = VALUES(coach),
           coach_url = VALUES(coach_url),
           source_payload = VALUES(source_payload),
           updated_at = CURRENT_TIMESTAMP`,
        [
          teamDocId,
          String(teamID),
          payload.name,
          payload.slug,
          payload.coach,
          payload.coachURL,
          JSON.stringify(payload),
        ]
      );
      return res.json({ id: teamDocId, ...payload });
    }

    const docRef = await db.collection("team").add(payload);
    return res.json({ id: docRef.id, ...payload });
  } catch (error) {
    console.error("Failed to create team:", error);
    return res.status(500).json({ message: "Unable to create team." });
  }
});

router.patch("/:teamId", async (req, res) => {
  const { teamId } = req.params || {};
  if (!teamId) {
    return res.status(400).json({ message: "teamId is required." });
  }

  const updates = req.body || {};
  if (updates.name && !updates.slug) {
    updates.slug = normalizeSlug(updates.name);
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const patch = {
        name: updates.name ?? undefined,
        slug: updates.slug ?? undefined,
        coach: updates.coach ?? undefined,
        coachURL: updates.coachURL ?? undefined,
        photoURL: updates.photoURL ?? undefined,
      };
      Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

      const [result] = await mysql.execute(
        `UPDATE teams
         SET name = COALESCE(?, name),
             slug = COALESCE(?, slug),
             coach = COALESCE(?, coach),
             coach_url = COALESCE(?, coach_url),
             source_payload = CASE
               WHEN ? IS NULL OR ? = '' THEN source_payload
               ELSE JSON_MERGE_PATCH(IFNULL(source_payload, JSON_OBJECT()), CAST(? AS JSON))
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE team_id = ?`,
        [
          updates.name ?? null,
          updates.slug ?? null,
          updates.coach ?? null,
          updates.coachURL ?? null,
          Object.keys(patch).length ? "1" : null,
          Object.keys(patch).length ? "1" : null,
          Object.keys(patch).length ? JSON.stringify(patch) : null,
          String(teamId),
        ]
      );
      if (!result.affectedRows) {
        return res.status(404).json({ message: "Team not found." });
      }
      return res.json({ ok: true });
    }

    const snapshot = await db.collection("team").where("teamID", "==", Number(teamId)).limit(1).get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.set(updates, { merge: true });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to update team:", error);
    return res.status(500).json({ message: "Unable to update team." });
  }
});

router.delete("/:teamId", async (req, res) => {
  const { teamId } = req.params || {};
  if (!teamId) {
    return res.status(400).json({ message: "teamId is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      await mysql.execute(`UPDATE players SET team_id = NULL, team_name = NULL WHERE team_id = ?`, [String(teamId)]);
      const [result] = await mysql.execute(`DELETE FROM teams WHERE team_id = ?`, [String(teamId)]);
      if (!result.affectedRows) {
        return res.status(404).json({ message: "Team not found." });
      }
      return res.json({ ok: true });
    }

    const snapshot = await db.collection("team").where("teamID", "==", Number(teamId)).get();
    const deletions = snapshot.docs.map((doc) => doc.ref.delete());
    await Promise.allSettled(deletions);

    const playersSnap = await db.collection("player").where("teamID", "==", Number(teamId)).get();
    await Promise.allSettled(
      playersSnap.docs.map((doc) => doc.ref.set({ teamID: null, teamName: null }, { merge: true }))
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete team:", error);
    return res.status(500).json({ message: "Unable to delete team." });
  }
});

export default router;
