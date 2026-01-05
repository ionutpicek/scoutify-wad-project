import express from "express";
import { recomputeAllSeasonGrades } from "../grading/recomputeAllSeasonGrades.js";

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

export default router;
