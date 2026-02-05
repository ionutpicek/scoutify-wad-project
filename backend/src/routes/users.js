import express from "express";
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

router.post("/register", async (req, res) => {
  const {
    uid,
    email,
    username,
    fullName,
    role,
    teamName,
    verifyUser = false,
    verifyEmail = false,
    playerDocId = null,
    playerID = null,
    matchedPlayerName = null
  } = req.body || {};

  if (!uid || !email || !username || !fullName || !role) {
    return res.status(400).json({ message: "uid, email, username, fullName, role are required." });
  }
  if (!shouldUseMysql()) {
    return res.status(500).json({ message: "MySQL not configured." });
  }

  try {
    const payload = {
      uid,
      email,
      username,
      fullName,
      role,
      teamName: teamName ?? null,
      verifyUser: Boolean(verifyUser),
      verifyEmail: Boolean(verifyEmail),
      playerDocId,
      playerID,
      matchedPlayerName
    };

    const mysql = getMysqlPool();
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
        email ?? null,
        username ?? null,
        fullName ?? null,
        role ?? null,
        teamName ?? null,
        verifyUser ? 1 : 0,
        playerDocId ?? null,
        toNullableBigInt(playerID),
        matchedPlayerName ?? null,
        JSON.stringify(payload)
      ]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to register user:", error);
    return res.status(500).json({ message: "Unable to register user." });
  }
});

router.get("/:uid", async (req, res) => {
  const { uid } = req.params || {};
  if (!uid) {
    return res.status(400).json({ message: "uid is required." });
  }
  if (!shouldUseMysql()) {
    return res.status(500).json({ message: "MySQL not configured." });
  }

  try {
    const mysql = getMysqlPool();
    const [rows] = await mysql.execute(
      `SELECT uid, email, username, full_name, role_name, team_name, verify_user,
              player_doc_id, player_id, matched_player_name, source_payload
       FROM app_users
       WHERE uid = ?
       LIMIT 1`,
      [String(uid)]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found." });
    return res.json({ user: mapMysqlUser(rows[0]) });
  } catch (error) {
    console.error("Failed to load user:", error);
    return res.status(500).json({ message: "Unable to load user." });
  }
});

router.patch("/:uid", async (req, res) => {
  const { uid } = req.params || {};
  if (!uid) {
    return res.status(400).json({ message: "uid is required." });
  }
  if (!shouldUseMysql()) {
    return res.status(500).json({ message: "MySQL not configured." });
  }

  try {
    const updates = req.body || {};
    const patch = {
      username: updates.username ?? undefined,
      fullName: updates.fullName ?? undefined,
      role: updates.role ?? undefined,
      teamName: updates.teamName ?? undefined,
      verifyUser: updates.verifyUser ?? undefined,
      verifyEmail: updates.verifyEmail ?? undefined,
      playerDocId: updates.playerDocId ?? undefined,
      playerID: updates.playerID ?? undefined,
      matchedPlayerName: updates.matchedPlayerName ?? undefined
    };
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

    const mysql = getMysqlPool();
    await mysql.execute(
      `UPDATE app_users
       SET username = COALESCE(?, username),
           full_name = COALESCE(?, full_name),
           role_name = COALESCE(?, role_name),
           team_name = COALESCE(?, team_name),
           verify_user = COALESCE(?, verify_user),
           player_doc_id = COALESCE(?, player_doc_id),
           player_id = COALESCE(?, player_id),
           matched_player_name = COALESCE(?, matched_player_name),
           source_payload = CASE
             WHEN ? IS NULL OR ? = '' THEN source_payload
             ELSE JSON_MERGE_PATCH(IFNULL(source_payload, JSON_OBJECT()), CAST(? AS JSON))
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE uid = ?`,
      [
        updates.username ?? null,
        updates.fullName ?? null,
        updates.role ?? null,
        updates.teamName ?? null,
        updates.verifyUser != null ? (updates.verifyUser ? 1 : 0) : null,
        updates.playerDocId ?? null,
        updates.playerID != null ? toNullableBigInt(updates.playerID) : null,
        updates.matchedPlayerName ?? null,
        Object.keys(patch).length ? "1" : null,
        Object.keys(patch).length ? "1" : null,
        Object.keys(patch).length ? JSON.stringify(patch) : null,
        String(uid)
      ]
    );

    return res.json({ ok: true });
  } catch (error) {
    console.error("Failed to update user:", error);
    return res.status(500).json({ message: "Unable to update user." });
  }
});

export default router;
