import express from "express";
import { recomputeAllSeasonGrades } from "../grading/recomputeAllSeasonGrades.js";
import { recomputeAllGameGrades } from "../grading/recomputeAllGameGrades.js";

const router = express.Router();

/**
 * POST /grading/recompute
 * Admin-only (you can add auth later)
 */
router.post("/recompute", async (req, res) => {
  try {
    await recomputeAllSeasonGrades();
    res.json({ ok: true });
  } catch (err) {
    console.error("Recompute failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /grading/recompute-game-grades
 * Body (optional): { dryRun: boolean, limit: number, pageSize: number }
 */
router.post("/recompute-game-grades", async (req, res) => {
  try {
    const summary = await recomputeAllGameGrades(req.body || {});
    res.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Game grade recompute failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
