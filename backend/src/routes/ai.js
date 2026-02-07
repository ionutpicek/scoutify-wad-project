import express from "express";
import multer from "multer";
import attachAiScoutVerdict from "../jobs/generateScoutVerdict.js";
import generatePlayerProfileSummary from "../ai/playerProfileSummary.js";
import buildTeamStylePrompt, { identifyTeamSide } from "../ai/teamStylePrompt.js";
import generateTeamReport from "../ai/teamReport.js";
import extractTeamSupplementFromPdf from "../ai/teamReportPdf.js";
import { db } from "../firebase/firebaseAdmin.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const TEAM_STYLE_FIELD = "teamStyleSummary";
const TEAM_REPORT_FIELD = "teamReport";
const MAX_TEAM_REPORT_SUPPLEMENTS = 10;

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

const MATCHES_COL = "matches";

const parseNumericId = value => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const asString = String(value).trim();
  if (!asString) return null;
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : null;
};

const addCandidateId = (set, value) => {
  if (value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;
    set.add(trimmed);
    const numeric = parseNumericId(trimmed);
    if (numeric != null) set.add(numeric);
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    set.add(value);
    set.add(String(value));
    return;
  }
  set.add(value);
};

const normalizeIdCandidates = async teamId => {
  const ids = new Set();
  addCandidateId(ids, teamId);

  let resolvedTeamDoc = null;
  if (teamId != null) {
    const docSnap = await db.collection("team").doc(String(teamId)).get();
    if (docSnap.exists) {
      resolvedTeamDoc = docSnap;
    }
  }

  if (!resolvedTeamDoc && teamId != null) {
    const numericTeamId = parseNumericId(teamId);
    if (numericTeamId != null) {
      const snap = await db
        .collection("team")
        .where("teamID", "==", numericTeamId)
        .limit(1)
        .get();
      if (!snap.empty) {
        resolvedTeamDoc = snap.docs[0];
      }
    }
  }

  if (!resolvedTeamDoc && typeof teamId === "string" && teamId.trim()) {
    const snap = await db
      .collection("team")
      .where("teamID", "==", teamId.trim())
      .limit(1)
      .get();
    if (!snap.empty) {
      resolvedTeamDoc = snap.docs[0];
    }
  }

  if (resolvedTeamDoc) {
    addCandidateId(ids, resolvedTeamDoc.id);
    addCandidateId(ids, resolvedTeamDoc.data()?.teamID);
  }

  return {
    idCandidates: Array.from(ids),
    teamDoc: resolvedTeamDoc
  };
};

const matchIncludesTeam = (match, teamIds, teamName) => {
  if (!match) return false;
  if (Array.isArray(teamIds)) {
    for (const id of teamIds) {
      if (identifyTeamSide(match, id, teamName)) return true;
    }
  }
  if (teamName) {
    return !!identifyTeamSide(match, null, teamName);
  }
  return false;
};

const fetchMatchesForTeam = async ({ teamIds, teamName }) => {
  const candidateIds = Array.isArray(teamIds) ? teamIds.slice(0, 10) : [];
  if (!candidateIds.length && !teamName) return [];

  const queries = [];
  if (candidateIds.length) {
    queries.push(db.collection(MATCHES_COL).where("homeTeamId", "in", candidateIds).get());
    queries.push(db.collection(MATCHES_COL).where("awayTeamId", "in", candidateIds).get());
  } else {
    queries.push(
      db
        .collection(MATCHES_COL)
        .orderBy("date", "desc")
        .limit(50)
        .get()
    );
  }

  const snaps = await Promise.all(queries);
  const matches = [];
  const seen = new Set();
  snaps.forEach(snap => {
    snap.docs.forEach(doc => {
      if (seen.has(doc.id)) return;
      seen.add(doc.id);
      matches.push({ id: doc.id, ...doc.data() });
    });
  });

  return matches.filter(match => matchIncludesTeam(match, candidateIds, teamName));
};

const isTruthy = value => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const hasStoredTeamStyle = teamData => {
  const stored = teamData?.[TEAM_STYLE_FIELD];
  return Boolean(stored?.prompt && typeof stored.prompt === "object");
};

const buildAndPersistTeamStyle = async ({ teamId, teamDoc, idCandidates, teamName }) => {
  const matches = await fetchMatchesForTeam({ teamIds: idCandidates, teamName });

  const prompt = await buildTeamStylePrompt({
    matches,
    teamId: idCandidates[0] ?? teamId,
    teamName
  });

  const payload = {
    teamId,
    teamName,
    matchesConsidered: prompt.matchesConsidered,
    prompt,
    matchIds: matches.map(m => m.id),
    generatedAt: new Date()
  };

  await teamDoc.ref.set(
    {
      [TEAM_STYLE_FIELD]: payload
    },
    { merge: true }
  );

  return payload;
};

const isStoredReportBody = value =>
  Boolean(
    value &&
      typeof value === "object" &&
      (
        typeof value.reportTitle === "string" ||
        typeof value.executiveSummary === "string" ||
        typeof value.matchesAnalyzed === "number" ||
        Array.isArray(value.sections) ||
        Array.isArray(value.keyMetrics)
      )
  );

const getStoredTeamReportPayload = ({ teamData, teamId, teamName }) => {
  const stored = teamData?.[TEAM_REPORT_FIELD];
  if (!stored || typeof stored !== "object") return null;

  if (isStoredReportBody(stored)) {
    return {
      teamId,
      teamName,
      report: stored
    };
  }

  if (isStoredReportBody(stored.report)) {
    return {
      teamId: stored.teamId ?? teamId,
      teamName: stored.teamName ?? teamName,
      report: stored.report
    };
  }

  return null;
};

const normalizeSupplements = value => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === "object")
    .slice(-MAX_TEAM_REPORT_SUPPLEMENTS);
};

const getStoredSupplements = teamData => {
  const payload = getStoredTeamReportPayload({
    teamData,
    teamId: null,
    teamName: null
  });
  return normalizeSupplements(payload?.report?.supplementalInsights);
};

const buildAndPersistTeamReport = async ({
  teamId,
  teamDoc,
  idCandidates,
  teamName,
  supplementalInsights = []
}) => {
  const matches = await fetchMatchesForTeam({ teamIds: idCandidates, teamName });
  const report = await generateTeamReport({
    matches,
    teamId: idCandidates[0] ?? teamId,
    teamName,
    maxMatches: 10,
    supplementalInsights: normalizeSupplements(supplementalInsights)
  });

  const payload = {
    teamId,
    teamName,
    generatedAt: new Date(),
    report
  };

  await teamDoc.ref.set(
    {
      [TEAM_REPORT_FIELD]: payload
    },
    { merge: true }
  );

  return payload;
};

router.get("/team-style/:teamId", async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    const regenerate = isTruthy(req.query?.regenerate);
    const { idCandidates, teamDoc } = await normalizeIdCandidates(teamId);
    if (!teamDoc) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamData = teamDoc.data() || {};
    const teamName = teamData.name ?? null;

    if (!regenerate && hasStoredTeamStyle(teamData)) {
      return res.json(teamData[TEAM_STYLE_FIELD]);
    }

    const payload = await buildAndPersistTeamStyle({
      teamId,
      teamDoc,
      idCandidates,
      teamName
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to generate team style summary:", error);
    return res.status(500).json({ error: "Could not compute team style summary." });
  }
});

router.post("/team-style/:teamId/regenerate", async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    const { idCandidates, teamDoc } = await normalizeIdCandidates(teamId);
    if (!teamDoc) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamData = teamDoc.data() || {};
    const teamName = teamData.name ?? null;

    const payload = await buildAndPersistTeamStyle({
      teamId,
      teamDoc,
      idCandidates,
      teamName
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to generate team style summary:", error);
    return res.status(500).json({ error: "Could not regenerate team style summary." });
  }
});

router.get("/team-report/:teamId", async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    const { idCandidates, teamDoc } = await normalizeIdCandidates(teamId);
    if (!teamDoc) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamData = teamDoc.data() || {};
    const teamName = teamData.name ?? null;
    const supplementalInsights = getStoredSupplements(teamData);
    const storedPayload = getStoredTeamReportPayload({
      teamData,
      teamId,
      teamName
    });

    if (storedPayload) {
      return res.json(storedPayload);
    }

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      idCandidates,
      teamName,
      supplementalInsights
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to generate team report:", error);
    return res.status(500).json({ error: "Could not compute team report." });
  }
});

router.post("/team-report/:teamId/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "No PDF uploaded (field name must be 'file')." });
    }

    const { idCandidates, teamDoc } = await normalizeIdCandidates(teamId);
    if (!teamDoc) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamData = teamDoc.data() || {};
    const teamName = teamData.name ?? null;
    const existingSupplements = getStoredSupplements(teamData);

    const supplement = await extractTeamSupplementFromPdf({
      pdfBuffer: req.file.buffer,
      filename: req.file.originalname || "team-report.pdf",
      teamName
    });

    const mergedSupplements = [...existingSupplements, supplement].slice(-MAX_TEAM_REPORT_SUPPLEMENTS);

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      idCandidates,
      teamName,
      supplementalInsights: mergedSupplements
    });

    return res.json({
      ...payload,
      uploadedSupplement: {
        id: supplement.id,
        sourceName: supplement.sourceName,
        generatedAt: supplement.generatedAt
      }
    });
  } catch (error) {
    console.error("Failed to upload team report supplement:", error);
    return res.status(500).json({ error: "Could not process uploaded report PDF." });
  }
});

router.post("/team-report/:teamId/regenerate", async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    const { idCandidates, teamDoc } = await normalizeIdCandidates(teamId);
    if (!teamDoc) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamData = teamDoc.data() || {};
    const teamName = teamData.name ?? null;
    const supplementalInsights = getStoredSupplements(teamData);

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      idCandidates,
      teamName,
      supplementalInsights
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to regenerate team report:", error);
    return res.status(500).json({ error: "Could not regenerate team report." });
  }
});

export default router;
