import express from "express";
import { db } from "../firebase/firebaseAdmin.js";

const router = express.Router();

const USERS_COLLECTION = "users";

router.get("/pending-verifications", async (req, res) => {
  try {
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

router.post("/link-player", async (req, res) => {
  const { uid, playerDocId } = req.body || {};
  if (!uid || !playerDocId) {
    return res.status(400).json({ message: "uid and playerDocId are required." });
  }

  try {
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

export default router;
