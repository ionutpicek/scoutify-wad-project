import express from "express";
import multer from "multer";
import { db } from "../firebase/firebaseAdmin.js";
import { importMatchFromPdf } from "../matchesPdf/importMatchFromPDF.js";
import { parseExcelMetrics } from "../gpsMetrics/parseExcel.js";
import { buildExcelHighlights } from "../gpsMetrics/buildHighlights.js";
import { gradeGame } from "../grading/gameGrade.js";
import { gradeGameGK } from "../grading/gradeGK.js";
import { pickBestPerformers } from "../grading/pickBestPerformer.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const MATCHES_COL = "matches";
const DEFAULT_LIMIT = 200;
const MIN_MINUTES_FOR_GRADE_OUTFIELD = 30;
const MIN_MINUTES_FOR_GRADE_GK = 45;

function handleFirestoreError(res, err, context = "") {
  const isQuota = err?.code === 8 || /quota|exhausted/i.test(err?.message || "");
  console.error("[matches]", context, err);
  return res.status(isQuota ? 503 : 500).json({
    error: isQuota ? "Firestore quota exceeded, try again in a minute" : "Failed to fetch matches"
  });
}

function regradePlayers(players = []) {
  if (!Array.isArray(players)) return [];

  return players.map(player => {
    const rolePlayed =
      player?.rolePlayed ||
      (String(player?.position || "").toUpperCase() === "GK" ? "GK" : "GENERIC");
    const minutesPlayed = Number(player?.minutesPlayed || 0);
    const isGK = rolePlayed === "GK";
    const hasStats = player?.matchStats && Object.keys(player.matchStats).length > 0;
    const minRequired = isGK ? MIN_MINUTES_FOR_GRADE_GK : MIN_MINUTES_FOR_GRADE_OUTFIELD;

    let gameGrade = null;
    if (hasStats && minutesPlayed >= minRequired) {
      gameGrade = isGK
        ? gradeGameGK({ derived: player?.derived || {} })
        : gradeGame({
            role: rolePlayed,
            rawStats: player?.matchStats || {},
            minutes: minutesPlayed
          });
    }

    const seasonGrade = player?.seasonGradeSnapshot?.overall10 ?? player?.seasonGrade ?? null;
    const delta =
      seasonGrade != null && gameGrade?.overall10 != null
        ? Math.round((Number(gameGrade.overall10) - Number(seasonGrade)) * 10) / 10
        : null;

    return {
      ...player,
      rolePlayed,
      gameGrade,
      grade: gameGrade?.overall10 ?? null,
      delta
    };
  });
}

// GET ALL MATCHES
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), 500);
    const snap = await db
      .collection(MATCHES_COL)
      .orderBy("date", "desc")
      .limit(limit)
      .get();

    const matches = snap.docs.map(d => {
      const data = d.data();
      const players = Array.isArray(data.players) ? data.players : [];
      const uniq = new Map();
      for (const p of players) {
        const pid = p.playerId || `${p.teamId || ""}-${p.name || ""}`;
        const mins = Number(p.minutesPlayed || 0);
        if (mins > 0 && !uniq.has(pid)) uniq.set(pid, true);
      }

      return {
        id: d.id,
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        date: data.date,
        round: data.round ?? null,
        score: data.score,
        playersCount: uniq.size,
        players,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId
      };
    });

    res.json(matches);
  } catch (err) {
    return handleFirestoreError(res, err, "list");
  }
});

// GET ONE MATCH
router.get("/:id", async (req, res) => {
  try {
    const ref = db.collection(MATCHES_COL).doc(req.params.id);
    const docSnap = await ref.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Match not found" });

    const data = docSnap.data() || {};
    const players = regradePlayers(data.players || []);
    const bestPerformers = pickBestPerformers(players);

    res.json({
      id: docSnap.id,
      ...data,
      players,
      bestPerformers,
      bestPerformer: bestPerformers
    });
  } catch (err) {
    return handleFirestoreError(res, err, "detail");
  }
});

// UPLOAD + IMPORT PDF
router.post(
  "/import-pdf",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "metrics", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const pdfFile = req.files?.file?.[0];
      if (!pdfFile?.buffer) {
        return res.status(400).json({ error: "No file uploaded (field name must be 'file')" });
      }

      const metricsFile = req.files?.metrics?.[0];

      const matchId = await importMatchFromPdf(pdfFile.buffer, pdfFile.originalname, {
        metricsBuffer: metricsFile?.buffer || null,
        metricsFilename: metricsFile?.originalname || null
      });

      const saved = await db.collection(MATCHES_COL).doc(matchId).get();
      const data = saved.exists ? saved.data() : null;

      return res.json({
        ok: true,
        matchId,
        match: data ? { id: matchId, ...data } : null
      });
    } catch (err) {
      console.error("import-pdf error:", err);
      return res.status(500).json({ error: err.message || "Import failed" });
    }
  }
);

// Upload GPS metrics Excel for an existing match (optionally scoped to one side)
router.post("/:id/upload-metrics", upload.single("metrics"), async (req, res) => {
  try {
    const { id } = req.params;
    const side = req.body?.side;

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "No metrics file uploaded (field name must be 'metrics')" });
    }
    if (side && side !== "home" && side !== "away") {
      return res.status(400).json({ error: "Invalid side; use 'home' or 'away'" });
    }

    const snap = await db.collection(MATCHES_COL).doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Match not found" });

    const data = snap.data() || {};
    const players = Array.isArray(data.players) ? data.players : [];
    if (!players.length) return res.status(400).json({ error: "Match has no players to map metrics" });

    const metrics = parseExcelMetrics(req.file.buffer);
    if (!metrics.length) return res.status(400).json({ error: "No rows parsed from Excel" });

    const norm = str =>
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z\s.]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const byTeam = { home: [], away: [] };
    const gpsMap = new Map();

    for (const row of metrics) {
      const matchPlayer = players.find(p => {
        const numMatch = row.number != null && p.number != null && Number(p.number) === Number(row.number);
        const nameMatch =
          norm(p.canonicalName || p.name) === norm(row.name) ||
          norm(p.name) === norm(row.name);
        return numMatch || nameMatch;
      });

      if (matchPlayer?.team === "home" || matchPlayer?.team === "away") {
        byTeam[matchPlayer.team].push(row);
        const key = matchPlayer.playerId || `${matchPlayer.team || ""}-${norm(matchPlayer.name)}`;
        gpsMap.set(key, row);
      }
    }

    const sidesToProcess = side ? [side] : ["home", "away"];
    const highlights = {};
    for (const s of sidesToProcess) {
      const h = buildExcelHighlights(byTeam[s]);
      if (h) highlights[s] = h;
    }

    if (!Object.keys(highlights).length) {
      return res.status(400).json({ error: "No metrics matched players for the requested side(s)" });
    }

    const existingNotes = data.gpsMetrics || {};
    // Overwrite existing GPS notes for the sides we process; keep the other side if not provided
    const mergedNotes = { ...(existingNotes || {}) };
    if (side) {
      mergedNotes[side] = highlights[side] || null;
    } else {
      mergedNotes.home = highlights.home || null;
      mergedNotes.away = highlights.away || null;
    }

    const buildGps = row => {
      if (!row) return null;
      const duration = row.durationMinutes || null;
      const dist = row.totalDistance || 0;
      const kmPer90 = duration ? (dist / duration) * (90 / 1000) : null;
      const gps = {
        totalDistanceMeters: dist || null,
        durationMinutes: duration,
        kmPer90,
        topSpeedKmh: row.maxSpeed ?? null,
        avgBpm: row.avgBpm ?? null,
        sprints: row.sprints ?? null
      };
      const hasVal = Object.values(gps).some(v => v !== null);
      return hasVal ? gps : null;
    };

    const updatedPlayers = players.map(p => {
      const key = p.playerId || `${p.team || ""}-${norm(p.name)}`;
      const row = gpsMap.get(key);
      const gps = buildGps(row);
      if (!gps) return p;
      return { ...p, gps };
    });

    await db.collection(MATCHES_COL).doc(id).set(
      {
        gpsMetrics: mergedNotes,
        players: updatedPlayers
      },
      { merge: true }
    );

    return res.json({
      ok: true,
      gpsMetrics: mergedNotes,
      matched: { home: byTeam.home.length, away: byTeam.away.length }
    });
  } catch (err) {
    console.error("upload-metrics error:", err);
    return res.status(500).json({ error: err.message || "Upload failed" });
  }
});

export default router;
