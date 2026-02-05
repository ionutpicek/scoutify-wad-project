import express from "express";
import crypto from "crypto";
import { db } from "../firebase/firebaseAdmin.js";
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const router = express.Router();

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const abbrName = (fullName) => {
  const parts = String(fullName || "").trim().split(" ").filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
};

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

const mapMysqlPlayer = (row) => {
  const payload = parseSourcePayload(row.source_payload);
  return {
    id: row.id,
    playerID: row.player_id ?? payload.playerID ?? null,
    teamID: row.team_id ?? payload.teamID ?? null,
    teamName: row.team_name ?? payload.teamName ?? null,
    name: row.name ?? payload.name ?? null,
    abbrName: row.abbr_name ?? payload.abbrName ?? null,
    position: row.position ?? payload.position ?? null,
    nationality: row.nationality ?? payload.nationality ?? null,
    birthdate: row.birthdate ?? payload.birthdate ?? null,
    photoURL: row.photo_url ?? payload.photoURL ?? payload.photoUrl ?? null,
    seasonGradeOverall: row.season_grade_overall ?? null,
  };
};

router.get("/search", async (req, res) => {
  const { fullName, teamName } = req.query || {};
  if (!fullName) {
    return res.status(400).json({ message: "fullName is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.query(
        `SELECT id, player_id, team_id, team_name, name, abbr_name, position, nationality, birthdate, photo_url, source_payload
         FROM players`
      );

      const target = normalizeName(fullName);
      const teamTarget = normalizeName(teamName);

      for (const row of rows) {
        const payload = parseSourcePayload(row.source_payload);
        const candidates = [row.name, payload.canonicalName, row.abbr_name, payload.abbrName]
          .filter(Boolean)
          .map(normalizeName);

        if (!candidates.some((value) => value === target)) continue;

        const playerTeamKey = normalizeName(row.team_name || payload.teamName || payload.team || "");
        if (
          teamTarget &&
          playerTeamKey &&
          !(playerTeamKey.includes(teamTarget) || teamTarget.includes(playerTeamKey))
        ) {
          continue;
        }
        if (teamTarget && !playerTeamKey) continue;

        return res.json({ player: mapMysqlPlayer(row) });
      }

      return res.json({ player: null });
    }

    return res.status(500).json({ message: "MySQL not configured." });
  } catch (error) {
    console.error("Failed to search player:", error);
    return res.status(500).json({ message: "Unable to search player." });
  }
});

router.get("/", async (req, res) => {
  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.query(
        `SELECT id, player_id, team_id, team_name, name, abbr_name, position, nationality,
                birthdate, photo_url, source_payload
         FROM players
         ORDER BY name ASC`
      );
      return res.json({ players: rows.map(mapMysqlPlayer) });
    }

    const snapshot = await db.collection("player").get();
    const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ players });
  } catch (error) {
    console.error("Failed to list players:", error);
    return res.status(500).json({ message: "Unable to load players." });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res.status(400).json({ message: "id is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.execute(
        `SELECT id, player_id, team_id, team_name, name, abbr_name, position, nationality,
                birthdate, photo_url, source_payload
         FROM players
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ message: "Player not found." });
      return res.json({ player: mapMysqlPlayer(rows[0]) });
    }

    const snap = await db.collection("player").doc(id).get();
    if (!snap.exists) return res.status(404).json({ message: "Player not found." });
    return res.json({ player: { id: snap.id, ...snap.data() } });
  } catch (error) {
    console.error("Failed to fetch player:", error);
    return res.status(500).json({ message: "Unable to load player." });
  }
});

router.get("/team/:teamId", async (req, res) => {
  const { teamId } = req.params || {};
  if (!teamId) {
    return res.status(400).json({ message: "teamId is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.execute(
        `SELECT p.id, p.player_id, p.team_id, p.team_name, p.name, p.abbr_name, p.position, p.nationality,
                p.birthdate, p.photo_url, p.source_payload, s.season_grade_overall
         FROM players p
         LEFT JOIN (
           SELECT player_id, MAX(season_grade_overall) AS season_grade_overall
           FROM stats
           GROUP BY player_id
         ) s ON p.player_id = s.player_id
         WHERE p.team_id = ?
         ORDER BY p.name ASC`,
        [String(teamId)]
      );

      return res.json({ players: rows.map(mapMysqlPlayer) });
    }

    const snapshot = await db.collection("player").where("teamID", "==", Number(teamId)).get();
    const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ players });
  } catch (error) {
    console.error("Failed to list team players:", error);
    return res.status(500).json({ message: "Unable to load players." });
  }
});

router.post("/", async (req, res) => {
  const { name, teamID, position, photoURL, teamName, birthdate, nationality } = req.body || {};
  if (!name || !teamID || !position) {
    return res.status(400).json({ message: "name, teamID, and position are required." });
  }

  try {
    const playerID = Date.now();
    const payload = {
      name,
      teamID,
      position,
      photoURL: photoURL ?? "",
      teamName,
      birthdate: birthdate ?? "",
      nationality: nationality ?? "",
      playerID,
      abbrName: abbrName(name),
    };

    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const playerDocId = crypto.randomUUID();
      const statsDocId = crypto.randomUUID();
      const statsPayload =
        position !== "Goalkeeper"
          ? { playerID, minutes: 0, goals: 0, assists: 0, shots: 0, passes: 0, dribbles: 0 }
          : {
              playerID,
              minutes: 0,
              xCG: 0,
              concededGoals: 0,
              saves: 0,
              cleanSheet: 0,
              shotAgainst: 0,
              shortGoalKicks: 0,
              longGoalKicks: 0,
            };

      await mysql.execute(
        `INSERT INTO players (id, player_id, team_id, team_name, name, abbr_name, position, nationality, birthdate, photo_url, source_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          playerDocId,
          playerID,
          String(teamID),
          teamName ?? null,
          name,
          payload.abbrName,
          position,
          nationality ?? null,
          birthdate ? String(birthdate).slice(0, 10) : null,
          photoURL ?? null,
          JSON.stringify(payload),
        ]
      );

      await mysql.execute(
        `INSERT INTO stats (id, player_id, minutes, season_role, season_grade_overall, scout_snapshot, source_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          statsDocId,
          playerID,
          0,
          null,
          null,
          null,
          JSON.stringify(statsPayload),
        ]
      );

      return res.json({ player: { id: playerDocId, ...payload } });
    }

    const playerRef = await db.collection("player").add(payload);

    const statsPayload =
      position !== "Goalkeeper"
        ? { playerID, minutes: 0, goals: 0, assists: 0, shots: 0, passes: 0, dribbles: 0 }
        : {
            playerID,
            minutes: 0,
            xCG: 0,
            concededGoals: 0,
            saves: 0,
            cleanSheet: 0,
            shotAgainst: 0,
            shortGoalKicks: 0,
            longGoalKicks: 0,
          };

    await db.collection("stats").add(statsPayload);

    return res.json({ player: { id: playerRef.id, ...payload } });
  } catch (error) {
    console.error("Failed to create player:", error);
    return res.status(500).json({ message: "Unable to create player." });
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params || {};
  if (!id) {
    return res.status(400).json({ message: "id is required." });
  }

  const updates = req.body || {};

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const normalizedBirthdate = updates.birthdate
        ? String(updates.birthdate).slice(0, 10)
        : null;

      const patch = {
        name: updates.name ?? undefined,
        teamID: updates.teamID ?? undefined,
        teamName: updates.teamName ?? undefined,
        position: updates.position ?? undefined,
        nationality: updates.nationality ?? undefined,
        birthdate: normalizedBirthdate ?? undefined,
        photoURL: updates.photoURL ?? undefined,
        abbrName: updates.abbrName ?? undefined,
      };
      Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

      await mysql.execute(
        `UPDATE players
         SET name = COALESCE(?, name),
             team_id = COALESCE(?, team_id),
             team_name = COALESCE(?, team_name),
             position = COALESCE(?, position),
             nationality = COALESCE(?, nationality),
             birthdate = COALESCE(?, birthdate),
             photo_url = COALESCE(?, photo_url),
             abbr_name = COALESCE(?, abbr_name),
             source_payload = CASE
               WHEN ? IS NULL OR ? = '' THEN source_payload
               ELSE JSON_MERGE_PATCH(IFNULL(source_payload, JSON_OBJECT()), CAST(? AS JSON))
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          updates.name ?? null,
          updates.teamID != null ? String(updates.teamID) : null,
          updates.teamName ?? null,
          updates.position ?? null,
          updates.nationality ?? null,
          normalizedBirthdate,
          updates.photoURL ?? null,
          updates.abbrName ?? null,
          Object.keys(patch).length ? "1" : null,
          Object.keys(patch).length ? "1" : null,
          Object.keys(patch).length ? JSON.stringify(patch) : null,
          id,
        ]
      );
      return res.json({ ok: true });
    }

    await db.collection("player").doc(id).set(updates, { merge: true });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to update player:", error);
    return res.status(500).json({ message: "Unable to update player." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params || {};
  const playerID = req.query?.playerID ?? req.body?.playerID ?? null;
  if (!id) {
    return res.status(400).json({ message: "id is required." });
  }

  try {
    if (shouldUseMysql()) {
      const mysql = getMysqlPool();
      const [result] = await mysql.execute(`DELETE FROM players WHERE id = ?`, [id]);
      const resolvedPlayerId = playerID ?? null;
      if (!result.affectedRows && resolvedPlayerId != null) {
        await mysql.execute(`DELETE FROM players WHERE player_id = ?`, [resolvedPlayerId]);
      }
      if (resolvedPlayerId != null) {
        await mysql.execute(`DELETE FROM stats WHERE player_id = ?`, [resolvedPlayerId]);
      }
      return res.json({ ok: true });
    }

    const playerRef = db.collection("player").doc(id);
    const snap = await playerRef.get();
    const payload = snap.exists ? snap.data() || {} : {};
    const resolvedPlayerId = playerID ?? payload.playerID ?? null;

    await playerRef.delete();
    if (resolvedPlayerId != null) {
      const statsSnap = await db.collection("stats").where("playerID", "==", resolvedPlayerId).get();
      await Promise.allSettled(statsSnap.docs.map((doc) => doc.ref.delete()));
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete player:", error);
    return res.status(500).json({ message: "Unable to delete player." });
  }
});

export default router;
