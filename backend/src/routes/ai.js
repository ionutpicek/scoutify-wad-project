import express from "express";
import multer from "multer";
import attachAiScoutVerdict from "../jobs/generateScoutVerdict.js";
import generatePlayerProfileSummary from "../ai/playerProfileSummary.js";
import buildTeamStylePrompt, { identifyTeamSide } from "../ai/teamStylePrompt.js";
import generateTeamReport from "../ai/teamReport.js";
import extractTeamSupplementFromPdf from "../ai/teamReportPdf.js";
import { db } from "../firebase/firebaseAdmin.js";
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const TEAM_STYLE_FIELD = "teamStyleSummary";
const TEAM_REPORT_FIELD = "teamReport";
const MAX_TEAM_REPORT_SUPPLEMENTS = 10;
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

const parseJsonField = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const buildTeamDataFromRow = (row) => {
  const payload = parseSourcePayload(row?.source_payload);
  return {
    ...payload,
    id: row?.id ?? payload.id ?? null,
    teamID: row?.team_id ?? payload.teamID ?? payload.teamId ?? null,
    name: row?.name ?? payload.name ?? null
  };
};

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

    if (!shouldUseMysql()) {
      return res.status(500).json({ error: "MySQL not configured." });
    }

    const mysql = getMysqlPool();
    const [playerRows] = await mysql.execute(
      `SELECT id, player_id, team_id, name, position, nationality, birthdate, photo_url, source_payload
       FROM players
       WHERE id = ?
       LIMIT 1`,
      [playerDocId]
    );
    if (!playerRows.length) {
      return res.status(404).json({ error: "Player not found" });
    }

    const playerRow = playerRows[0];
    const playerPayload = parseSourcePayload(playerRow.source_payload);
    const player = {
      ...playerPayload,
      id: playerRow.id,
      playerID: playerRow.player_id ?? playerPayload.playerID ?? null,
      teamID: playerRow.team_id ?? playerPayload.teamID ?? null,
      name: playerRow.name ?? playerPayload.name ?? null,
      position: playerRow.position ?? playerPayload.position ?? null,
      nationality: playerRow.nationality ?? playerPayload.nationality ?? null,
      birthdate: playerRow.birthdate ?? playerPayload.birthdate ?? null,
      photoURL: playerRow.photo_url ?? playerPayload.photoURL ?? null
    };

    let stats = null;
    if (player.playerID != null) {
      const [statsRows] = await mysql.execute(
        `SELECT source_payload FROM stats WHERE player_id = ? LIMIT 1`,
        [player.playerID]
      );
      if (statsRows.length) {
        stats = parseSourcePayload(statsRows[0].source_payload);
      }
    }

    let team = null;
    if (player.teamID) {
      const [teamRows] = await mysql.execute(
        `SELECT id, team_id, name, source_payload FROM teams WHERE team_id = ? LIMIT 1`,
        [String(player.teamID)]
      );
      if (teamRows.length) {
        const teamPayload = parseSourcePayload(teamRows[0].source_payload);
        team = {
          ...teamPayload,
          id: teamRows[0].id,
          teamID: teamRows[0].team_id ?? teamPayload.teamID ?? null,
          name: teamRows[0].name ?? teamPayload.name ?? null
        };
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

  if (shouldUseMysql()) {
    const mysql = getMysqlPool();
    const teamIdValue = teamId != null ? String(teamId).trim() : "";
    if (teamIdValue) {
      const [rows] = await mysql.execute(
        `SELECT id, team_id, name, source_payload
         FROM teams
         WHERE id = ? OR team_id = ?
         LIMIT 1`,
        [teamIdValue, teamIdValue]
      );
      if (rows.length) {
        const row = rows[0];
        const teamData = buildTeamDataFromRow(row);
        addCandidateId(ids, row.id);
        addCandidateId(ids, row.team_id);
        addCandidateId(ids, teamData?.teamID);
        return {
          idCandidates: Array.from(ids),
          teamRow: row,
          teamData
        };
      }
    }

    return {
      idCandidates: Array.from(ids),
      teamRow: null,
      teamData: null
    };
  }

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
    teamDoc: resolvedTeamDoc,
    teamData: resolvedTeamDoc ? resolvedTeamDoc.data() || {} : null
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

  if (shouldUseMysql()) {
    const mysql = getMysqlPool();
    const limit = 50;
    let rows = [];
    if (candidateIds.length) {
      const [result] = await mysql.query(
        `SELECT id, match_date, round_no, home_team, away_team, score, home_team_id, away_team_id,
                home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json, source_payload
         FROM matches
         WHERE home_team_id IN (?) OR away_team_id IN (?)
         ORDER BY match_date DESC
         LIMIT ?`,
        [candidateIds, candidateIds, limit]
      );
      rows = result || [];
    } else {
      const [result] = await mysql.query(
        `SELECT id, match_date, round_no, home_team, away_team, score, home_team_id, away_team_id,
                home_goals, away_goals, team_stats, gps_metrics, best_performers, players_json, source_payload
         FROM matches
         ORDER BY match_date DESC
         LIMIT ?`,
        [limit]
      );
      rows = result || [];
    }

    const matches = rows.map(row => ({
      id: row.id,
      date: row.match_date,
      round: row.round_no,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      score: row.score,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
      homeGoals: row.home_goals,
      awayGoals: row.away_goals,
      teamStats: parseJsonField(row.team_stats, null),
      gpsMetrics: parseJsonField(row.gps_metrics, null),
      bestPerformers: parseJsonField(row.best_performers, null),
      players: parseJsonField(row.players_json, []),
      sourcePayload: parseSourcePayload(row.source_payload)
    }));

    return matches.filter(match => matchIncludesTeam(match, candidateIds, teamName));
  }

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

const persistTeamPayload = async ({ teamDoc, teamRowId, payload }) => {
  if (shouldUseMysql() && teamRowId) {
    const mysql = getMysqlPool();
    const patch = payload && typeof payload === "object" ? payload : null;
    await mysql.execute(
      `UPDATE teams
       SET source_payload = CASE
         WHEN ? IS NULL OR ? = '' THEN source_payload
         ELSE JSON_MERGE_PATCH(IFNULL(source_payload, JSON_OBJECT()), CAST(? AS JSON))
       END,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch ? "1" : null,
        patch ? "1" : null,
        patch ? JSON.stringify(patch) : null,
        teamRowId
      ]
    );
  }

  if (teamDoc) {
    await teamDoc.ref.set(payload, { merge: true });
  }
};

const buildAndPersistTeamStyle = async ({ teamId, teamDoc, teamRowId, idCandidates, teamName }) => {
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

  await persistTeamPayload({
    teamDoc,
    teamRowId,
    payload: { [TEAM_STYLE_FIELD]: payload }
  });

  return payload;
};

const hasStoredTeamReport = teamData => {
  const stored = teamData?.[TEAM_REPORT_FIELD];
  return Boolean(stored && typeof stored === "object" && stored.matchesAnalyzed != null);
};

const normalizeSupplements = value => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === "object")
    .slice(-MAX_TEAM_REPORT_SUPPLEMENTS);
};

const getStoredSupplements = teamData => {
  const report = teamData?.[TEAM_REPORT_FIELD];
  return normalizeSupplements(report?.supplementalInsights);
};

const buildAndPersistTeamReport = async ({
  teamId,
  teamDoc,
  teamRowId,
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

  await persistTeamPayload({
    teamDoc,
    teamRowId,
    payload: { [TEAM_REPORT_FIELD]: report }
  });

  return {
    teamId,
    teamName,
    report
  };
};

router.get("/team-style/:teamId", async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }

    const regenerate = isTruthy(req.query?.regenerate);
    const { idCandidates, teamDoc, teamRow, teamData } = await normalizeIdCandidates(teamId);
    if (!teamDoc && !teamRow) {
      return res.status(404).json({ error: "Team not found" });
    }

    const resolvedTeamData = teamData || (teamDoc ? teamDoc.data() || {} : {});
    const teamName = resolvedTeamData.name ?? null;

    if (!regenerate && hasStoredTeamStyle(resolvedTeamData)) {
      return res.json(resolvedTeamData[TEAM_STYLE_FIELD]);
    }

    const payload = await buildAndPersistTeamStyle({
      teamId,
      teamDoc,
      teamRowId: teamRow?.id ?? null,
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

    const { idCandidates, teamDoc, teamRow, teamData } = await normalizeIdCandidates(teamId);
    if (!teamDoc && !teamRow) {
      return res.status(404).json({ error: "Team not found" });
    }

    const resolvedTeamData = teamData || (teamDoc ? teamDoc.data() || {} : {});
    const teamName = resolvedTeamData.name ?? null;

    const payload = await buildAndPersistTeamStyle({
      teamId,
      teamDoc,
      teamRowId: teamRow?.id ?? null,
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

    const regenerate = isTruthy(req.query?.regenerate);
    const { idCandidates, teamDoc, teamRow, teamData } = await normalizeIdCandidates(teamId);
    if (!teamDoc && !teamRow) {
      return res.status(404).json({ error: "Team not found" });
    }

    const resolvedTeamData = teamData || (teamDoc ? teamDoc.data() || {} : {});
    const teamName = resolvedTeamData.name ?? null;
    const supplementalInsights = getStoredSupplements(resolvedTeamData);

    if (!regenerate && hasStoredTeamReport(resolvedTeamData)) {
      return res.json({
        teamId,
        teamName,
        report: resolvedTeamData[TEAM_REPORT_FIELD]
      });
    }

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      teamRowId: teamRow?.id ?? null,
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

    const { idCandidates, teamDoc, teamRow, teamData } = await normalizeIdCandidates(teamId);
    if (!teamDoc && !teamRow) {
      return res.status(404).json({ error: "Team not found" });
    }

    const resolvedTeamData = teamData || (teamDoc ? teamDoc.data() || {} : {});
    const teamName = resolvedTeamData.name ?? null;
    const existingSupplements = getStoredSupplements(resolvedTeamData);

    const supplement = await extractTeamSupplementFromPdf({
      pdfBuffer: req.file.buffer,
      filename: req.file.originalname || "team-report.pdf",
      teamName
    });

    const mergedSupplements = [...existingSupplements, supplement].slice(-MAX_TEAM_REPORT_SUPPLEMENTS);

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      teamRowId: teamRow?.id ?? null,
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

    const { idCandidates, teamDoc, teamRow, teamData } = await normalizeIdCandidates(teamId);
    if (!teamDoc && !teamRow) {
      return res.status(404).json({ error: "Team not found" });
    }

    const resolvedTeamData = teamData || (teamDoc ? teamDoc.data() || {} : {});
    const teamName = resolvedTeamData.name ?? null;
    const supplementalInsights = getStoredSupplements(resolvedTeamData);

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      teamRowId: teamRow?.id ?? null,
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
