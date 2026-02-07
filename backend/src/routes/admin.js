import express from "express";
import admin from "firebase-admin";
import { db } from "../firebase/firebaseAdmin.js";
import generatePlayerProfileSummary from "../ai/playerProfileSummary.js";

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

router.post("/generate-scout-snapshot", async (req, res) => {
  const { statsDocId, playerDocId } = req.body || {};
  if (!statsDocId) {
    return res.status(400).json({ message: "statsDocId is required." });
  }

  try {
    const statsRef = db.collection("stats").doc(statsDocId);
    const statsSnap = await statsRef.get();
    if (!statsSnap.exists) {
      return res.status(404).json({ message: "Stats document not found." });
    }

    const stats = statsSnap.data() || {};

    let player = null;
    let playerIdToFetch = playerDocId || stats.playerDocId || null;
    if (!playerIdToFetch && stats.playerID != null) {
      const playerQuery = await db
        .collection("player")
        .where("playerID", "==", stats.playerID)
        .limit(1)
        .get();
      if (!playerQuery.empty) {
        playerIdToFetch = playerQuery.docs[0].id;
        player = playerQuery.docs[0].data() || null;
      }
    }
    if (!player && playerIdToFetch) {
      const playerSnap = await db.collection("player").doc(playerIdToFetch).get();
      player = playerSnap.exists ? playerSnap.data() : null;
    }

    let team = null;
    if (player?.teamID) {
      const teamSnap = await db
        .collection("team")
        .where("teamID", "==", player.teamID)
        .limit(1)
        .get();
      if (!teamSnap.empty) {
        team = teamSnap.docs[0].data();
      }
    }

    const summary = await generatePlayerProfileSummary({ player, team, stats });

    await statsRef.update({
      "seasonGrade.scoutSnapshot": summary,
      "seasonGrade.scoutSnapshotGeneratedAt": admin.firestore.FieldValue.serverTimestamp(),
    });

    if (playerIdToFetch) {
      const playerRef = db.collection("player").doc(playerIdToFetch);
      await playerRef.set(
        {
          insights: {
            scoutSnapshot: summary,
            scoutSnapshotGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            scoutSnapshotStatsDocId: statsDocId,
          },
        },
        { merge: true }
      );
    }

    res.json({ summary });
  } catch (error) {
    console.error("Failed to generate scout snapshot:", error);
    res.status(500).json({ message: "Unable to generate scout snapshot." });
  }
});

export default router;
