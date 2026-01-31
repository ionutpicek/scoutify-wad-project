import express from "express";
import attachAiScoutVerdict from "../jobs/generateScoutVerdict.js";
import generatePlayerProfileSummary from "../ai/playerProfileSummary.js";
import { db } from "../firebase/firebaseAdmin.js";

const router = express.Router();

router.post("/scout-verdict/:statsDocId", async (req, res) => {
  try {
    const { statsDocId } = req.params;

    const result = await attachAiScoutVerdict(statsDocId);

    res.json({
      aiVerdict: result.aiVerdict,
    });
  } catch (err) {
    console.error("AI scout verdict failed:", err);
    res.status(500).json({ error: "Failed to generate AI verdict" });
  }
});

router.get("/player-summary/:playerDocId", async (req, res) => {
  try {
    const { playerDocId } = req.params;
    if (!playerDocId) {
      return res.status(400).json({ error: "playerDocId is required" });
    }

    const playerRef = db.collection("player").doc(playerDocId);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = playerSnap.data() || {};
    const playerID = player.playerID;

    let stats = null;
    if (playerID != null) {
      const statsQuery = await db
        .collection("stats")
        .where("playerID", "==", playerID)
        .limit(1)
        .get();
      if (!statsQuery.empty) {
        stats = statsQuery.docs[0].data();
      }
    }

    let team = null;
    if (player.teamID) {
      const teamQuery = await db
        .collection("team")
        .where("teamID", "==", player.teamID)
        .limit(1)
        .get();
      if (!teamQuery.empty) {
        team = teamQuery.docs[0].data();
      }
    }

    const summary = await generatePlayerProfileSummary({
      player: { id: playerDocId, ...player },
      team,
      stats,
    });

    res.json({ summary });
  } catch (error) {
    console.error("Failed to generate player summary:", error);
    res.status(500).json({ error: "Unable to generate player profile summary." });
  }
});

export default router;
