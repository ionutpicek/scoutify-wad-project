import express from "express";
import  attachAiScoutVerdict  from "../jobs/generateScoutVerdict.js";

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

export default router;
