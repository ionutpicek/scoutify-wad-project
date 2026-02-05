import express from "express";
import admin from "firebase-admin";
import { db } from "../firebase/firebaseAdmin.js";
import generatePlayerProfileSummary from "../ai/playerProfileSummary.js";
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const router = express.Router();

const USERS_COLLECTION = "users";
const shouldUseMysqlQueue = () => isMysqlConfigured();

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

const mapMysqlUser = (row) => {
  const payload = parseSourcePayload(row.source_payload);
  return {
    ...payload,
    uid: row.uid,
    email: row.email ?? payload.email ?? null,
    username: row.username ?? payload.username ?? null,
    fullName: row.full_name ?? payload.fullName ?? null,
    role: row.role_name ?? payload.role ?? null,
    teamName: row.team_name ?? payload.teamName ?? null,
    verifyUser:
      row.verify_user != null ? Boolean(row.verify_user) : Boolean(payload.verifyUser),
    verifyEmail: Boolean(payload.verifyEmail),
    playerDocId: row.player_doc_id ?? payload.playerDocId ?? null,
    playerID: row.player_id ?? payload.playerID ?? null,
    matchedPlayerName: row.matched_player_name ?? payload.matchedPlayerName ?? null,
  };
};

const toNullableBigInt = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const upsertMysqlUser = async (mysql, uid, payload = {}) => {
  await mysql.execute(
    `INSERT INTO app_users (
      uid, email, username, full_name, role_name, team_name, verify_user,
      player_doc_id, player_id, matched_player_name, source_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      username = VALUES(username),
      full_name = VALUES(full_name),
      role_name = VALUES(role_name),
      team_name = VALUES(team_name),
      verify_user = VALUES(verify_user),
      player_doc_id = VALUES(player_doc_id),
      player_id = VALUES(player_id),
      matched_player_name = VALUES(matched_player_name),
      source_payload = VALUES(source_payload),
      updated_at = CURRENT_TIMESTAMP`,
    [
      String(uid),
      payload.email ?? null,
      payload.username ?? null,
      payload.fullName ?? null,
      payload.role ?? null,
      payload.teamName ?? null,
      payload.verifyUser != null ? (payload.verifyUser ? 1 : 0) : null,
      payload.playerDocId ?? null,
      toNullableBigInt(payload.playerID),
      payload.matchedPlayerName ?? null,
      JSON.stringify(payload),
    ]
  );
};

router.get("/pending-verifications", async (req, res) => {
  try {
    if (shouldUseMysqlQueue()) {
      const mysql = getMysqlPool();
      const [rows] = await mysql.query(
        `SELECT uid, email, username, full_name, role_name, team_name, verify_user, player_doc_id, player_id, matched_player_name, source_payload
         FROM app_users
         WHERE (verify_user = 0 OR verify_user IS NULL)
         ORDER BY updated_at DESC`
      );
      return res.json({ users: rows.map(mapMysqlUser) });
    }

    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("verifyUser", "==", false)
      .get();

    const users = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    res.json({ users });
  } catch (error) {
    console.error("Failed to fetch pending verifications:", error);
    res.status(500).json({ message: "Unable to fetch pending verifications." });
  }
});

router.post("/verify-user", async (req, res) => {
  const { uid } = req.body || {};
  if (!uid) {
    return res.status(400).json({ message: "uid is required." });
  }

  try {
    if (shouldUseMysqlQueue()) {
      const mysql = getMysqlPool();
      const [result] = await mysql.execute(
        `UPDATE app_users
         SET verify_user = 1, updated_at = CURRENT_TIMESTAMP
         WHERE uid = ?`,
        [uid]
      );
      if (result.affectedRows) {
        return res.json({ ok: true });
      }
    }

    const userRef = db.collection(USERS_COLLECTION).doc(uid);
    const docSnapshot = await userRef.get();
    if (!docSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    await userRef.update({ verifyUser: true });
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to mark user verified:", error);
    res.status(500).json({ message: "Unable to verify user." });
  }
});

router.delete("/user-request/:uid", async (req, res) => {
  const { uid } = req.params || {};
  if (!uid) {
    return res.status(400).json({ message: "uid is required." });
  }

  try {
    if (shouldUseMysqlQueue()) {
      const mysql = getMysqlPool();
      const [result] = await mysql.execute(`DELETE FROM app_users WHERE uid = ?`, [uid]);
      const mysqlDeleted = Boolean(result.affectedRows);
      if (mysqlDeleted) {
        try {
          await admin.auth().deleteUser(uid);
        } catch (error) {
          if (error?.code !== "auth/user-not-found") throw error;
        }
        return res.json({
          ok: true,
          deletedUid: uid,
          deletedFromMysql: true,
          deletedFromFirestore: false,
          deletedFromAuth: true,
        });
      }
    }

    const userRef = db.collection(USERS_COLLECTION).doc(uid);
    const docSnapshot = await userRef.get();
    if (!docSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    await Promise.allSettled([
      userRef.delete(),
      admin.auth().deleteUser(uid),
    ]).then((results) => {
      const [firestoreDelete, authDelete] = results;
      if (firestoreDelete.status === "rejected") {
        throw firestoreDelete.reason;
      }
      if (authDelete.status === "rejected") {
        throw authDelete.reason;
      }
    });

    res.json({ ok: true, deletedUid: uid, deletedFromFirestore: true, deletedFromAuth: true });
  } catch (error) {
    console.error("Failed to delete user request:", error);
    res.status(500).json({ message: "Unable to delete user request." });
  }
});

router.post("/link-player", async (req, res) => {
  const { uid, playerDocId } = req.body || {};
  if (!uid || !playerDocId) {
    return res.status(400).json({ message: "uid and playerDocId are required." });
  }

  try {
    if (shouldUseMysqlQueue()) {
      const mysql = getMysqlPool();
      const [playerRows] = await mysql.execute(
        `SELECT id, player_id, name FROM players WHERE id = ? LIMIT 1`,
        [playerDocId]
      );
      const player = playerRows[0];
      if (!player) {
        return res.status(404).json({ message: "Player not found." });
      }

      const [result] = await mysql.execute(
        `UPDATE app_users
         SET player_doc_id = ?, player_id = ?, matched_player_name = ?, updated_at = CURRENT_TIMESTAMP
         WHERE uid = ?`,
        [player.id, player.player_id ?? null, player.name ?? null, uid]
      );
      if (result.affectedRows) {
        return res.json({
          player: {
            playerDocId: player.id,
            playerID: player.player_id ?? null,
            matchedPlayerName: player.name ?? null,
          },
        });
      }
    }

    const playerRef = db.collection("player").doc(playerDocId);
    const playerSnapshot = await playerRef.get();
    if (!playerSnapshot.exists) {
      return res.status(404).json({ message: "Player not found." });
    }

    const playerData = playerSnapshot.data() || {};
    const payload = {
      playerDocId,
      playerID: playerData.playerID || null,
      matchedPlayerName: playerData.name || null,
    };

    await db.collection(USERS_COLLECTION).doc(uid).update(payload);

    res.json({ player: payload });
  } catch (error) {
    console.error("Failed to link player:", error);
    res.status(500).json({ message: "Unable to link player to account." });
  }
});

router.post("/sync-user/:uid", async (req, res) => {
  const { uid } = req.params || {};
  if (!uid) {
    return res.status(400).json({ message: "uid is required." });
  }
  if (!shouldUseMysqlQueue()) {
    return res.json({ ok: true, skipped: true, reason: "mysql-not-configured" });
  }

  try {
    const userRef = db.collection(USERS_COLLECTION).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ message: "User not found in Firestore." });
    }

    const payload = userSnap.data() || {};
    const mysql = getMysqlPool();
    await upsertMysqlUser(mysql, uid, payload);
    return res.json({ ok: true, uid, syncedToMysql: true });
  } catch (error) {
    console.error("Failed to sync user to MySQL:", error);
    return res.status(500).json({ message: "Unable to sync user to MySQL." });
  }
});

router.post("/generate-scout-snapshot", async (req, res) => {
  const { statsDocId, playerDocId } = req.body || {};
  if (!statsDocId) {
    return res.status(400).json({ message: "statsDocId is required." });
  }

  try {
    if (!shouldUseMysqlQueue()) {
      return res.status(500).json({ message: "MySQL not configured." });
    }

    const mysql = getMysqlPool();
    const [statsRows] = await mysql.execute(
      `SELECT id, player_id, source_payload
       FROM stats
       WHERE id = ?
       LIMIT 1`,
      [statsDocId]
    );
    if (!statsRows.length) {
      return res.status(404).json({ message: "Stats document not found." });
    }

    const statsRow = statsRows[0];
    const statsPayload = parseSourcePayload(statsRow.source_payload);

    let player = null;
    if (playerDocId) {
      const [playerRows] = await mysql.execute(
        `SELECT id, player_id, team_id, name, position, nationality, birthdate, photo_url, source_payload
         FROM players
         WHERE id = ?
         LIMIT 1`,
        [playerDocId]
      );
      if (playerRows.length) {
        const row = playerRows[0];
        const payload = parseSourcePayload(row.source_payload);
        player = {
          ...payload,
          id: row.id,
          playerID: row.player_id ?? payload.playerID ?? null,
          teamID: row.team_id ?? payload.teamID ?? null,
          name: row.name ?? payload.name ?? null,
          position: row.position ?? payload.position ?? null,
          nationality: row.nationality ?? payload.nationality ?? null,
          birthdate: row.birthdate ?? payload.birthdate ?? null,
          photoURL: row.photo_url ?? payload.photoURL ?? null
        };
      }
    }

    if (!player && statsRow.player_id != null) {
      const [playerRows] = await mysql.execute(
        `SELECT id, player_id, team_id, name, position, nationality, birthdate, photo_url, source_payload
         FROM players
         WHERE player_id = ?
         LIMIT 1`,
        [statsRow.player_id]
      );
      if (playerRows.length) {
        const row = playerRows[0];
        const payload = parseSourcePayload(row.source_payload);
        player = {
          ...payload,
          id: row.id,
          playerID: row.player_id ?? payload.playerID ?? null,
          teamID: row.team_id ?? payload.teamID ?? null,
          name: row.name ?? payload.name ?? null,
          position: row.position ?? payload.position ?? null,
          nationality: row.nationality ?? payload.nationality ?? null,
          birthdate: row.birthdate ?? payload.birthdate ?? null,
          photoURL: row.photo_url ?? payload.photoURL ?? null
        };
      }
    }

    let team = null;
    if (player?.teamID) {
      const [teamRows] = await mysql.execute(
        `SELECT id, team_id, name, source_payload
         FROM teams
         WHERE team_id = ?
         LIMIT 1`,
        [String(player.teamID)]
      );
      if (teamRows.length) {
        const row = teamRows[0];
        const payload = parseSourcePayload(row.source_payload);
        team = {
          ...payload,
          id: row.id,
          teamID: row.team_id ?? payload.teamID ?? null,
          name: row.name ?? payload.name ?? null
        };
      }
    }

    const summary = await generatePlayerProfileSummary({
      player,
      team,
      stats: statsPayload
    });

    const nextPayload = {
      ...statsPayload,
      seasonGrade: {
        ...(statsPayload.seasonGrade || {}),
        scoutSnapshot: summary,
        scoutSnapshotGeneratedAt: new Date().toISOString()
      }
    };

    await mysql.execute(
      `UPDATE stats
       SET scout_snapshot = ?, source_payload = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [summary, JSON.stringify(nextPayload), statsDocId]
    );

    res.json({ summary });
  } catch (error) {
    console.error("Failed to generate scout snapshot:", error);
    res.status(500).json({ message: "Unable to generate scout snapshot." });
  }
});

export default router;
