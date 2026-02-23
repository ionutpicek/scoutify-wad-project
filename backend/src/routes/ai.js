import express from "express";
import multer from "multer";
import attachAiScoutVerdict from "../jobs/generateScoutVerdict.js";
import generatePlayerProfileSummary from "../ai/playerProfileSummary.js";
import buildTeamStylePrompt, { identifyTeamSide } from "../ai/teamStylePrompt.js";
import generateTeamReport from "../ai/teamReport.js";
import extractTeamSupplementFromPdf from "../ai/teamReportPdf.js";
import { streamPlayerCvPdf } from "../ai/playerCvPdf.js";
import { generateTacticalPlan } from "../ai/tacticalPlanner.js";
import { adminAuth, db } from "../firebase/firebaseAdmin.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const TEAM_STYLE_FIELD = "teamStyleSummary";
const TEAM_REPORT_FIELD = "teamReport";
const MAX_TEAM_REPORT_SUPPLEMENTS = 10;
const DEFAULT_TEAM_REPORT_LANGUAGE = "en";
const TEAM_REPORT_LANGUAGES = new Set(["en", "ro"]);
const DEFAULT_PLAYER_INSIGHT_LANGUAGE = "en";
const PLAYER_INSIGHT_LANGUAGES = new Set(["en", "ro"]);
const USERS_COLLECTION = "users";
const MAX_PLAYER_CV_MATCH_SCAN = 300;
const MAX_PLAYER_CV_MATCHES = 20;

const normalizeText = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getRequesterContext = async req => {
  const authHeader =
    typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    const userDoc = await db.collection(USERS_COLLECTION).doc(decoded.uid).get();
    const userData = userDoc.data() || {};
    return {
      uid: decoded.uid,
      role: String(userData.role || "").trim().toLowerCase(),
      teamName: userData.teamName || null,
      userTeam: userData.userTeam || null,
      playerDocId: userData.playerDocId || null
    };
  } catch (error) {
    return null;
  }
};

const requireAdminUser = async req => {
  const requester = await getRequesterContext(req);
  return requester?.role === "admin" ? requester.uid : null;
};

router.post("/scout-verdict/:statsDocId", async (req, res) => {
  try {
    const requesterUid = await requireAdminUser(req);
    if (!requesterUid) {
      return res.status(403).json({ error: "Admin privileges required." });
    }

    const { statsDocId } = req.params;
    const requestedLanguage = normalizePlayerInsightLanguage(req.body?.language);
    if (req.body?.language && !requestedLanguage) {
      return res.status(400).json({ error: "language must be one of: en, ro" });
    }

    const result = await attachAiScoutVerdict(statsDocId, {
      language: requestedLanguage || DEFAULT_PLAYER_INSIGHT_LANGUAGE,
    });

    res.json({
      aiVerdict: result.aiVerdict,
      language: result.language || requestedLanguage || DEFAULT_PLAYER_INSIGHT_LANGUAGE,
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
    const requestedLanguage = normalizePlayerInsightLanguage(req.query?.language);
    if (req.query?.language && !requestedLanguage) {
      return res.status(400).json({ error: "language must be one of: en, ro" });
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
      language: requestedLanguage || DEFAULT_PLAYER_INSIGHT_LANGUAGE,
    });

    res.json({ summary, language: requestedLanguage || DEFAULT_PLAYER_INSIGHT_LANGUAGE });
  } catch (error) {
    console.error("Failed to generate player summary:", error);
    res.status(500).json({ error: "Unable to generate player profile summary." });
  }
});

const buildScalarCandidates = value => {
  const candidates = [];
  const seen = new Set();
  const pushValue = candidate => {
    const key = `${typeof candidate}:${String(candidate)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  if (value == null) return candidates;
  if (typeof value === "number" && Number.isFinite(value)) {
    pushValue(value);
    pushValue(String(value));
    return candidates;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return candidates;
  pushValue(trimmed);
  const numeric = parseNumericId(trimmed);
  if (numeric != null) pushValue(numeric);
  return candidates;
};

const selectBestStatsDoc = docs => {
  if (!Array.isArray(docs) || !docs.length) return null;
  const ranked = docs
    .map((docSnap, index) => {
      const data = docSnap.data() || {};
      const seasonGrade = data.seasonGrade || {};
      const hasSnapshot =
        typeof seasonGrade.scoutSnapshot === "string" &&
        seasonGrade.scoutSnapshot.trim().length > 0;
      const snapshotSeconds =
        typeof seasonGrade.scoutSnapshotGeneratedAt?.seconds === "number"
          ? seasonGrade.scoutSnapshotGeneratedAt.seconds
          : typeof seasonGrade.scoutSnapshotGeneratedAt?._seconds === "number"
            ? seasonGrade.scoutSnapshotGeneratedAt._seconds
            : 0;
      const hasGrade = seasonGrade.overall10 != null || seasonGrade.overall != null;
      const minutes = Number(data.minutes) || 0;
      const games = Number(data.games) || 0;
      const score =
        (hasSnapshot ? 1_000_000_000 : 0) +
        snapshotSeconds * 1000 +
        (hasGrade ? 1_000_000 : 0) +
        minutes * 100 +
        games;
      return { docSnap, data, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0] || null;
};

const fetchBestStatsForPlayer = async playerID => {
  if (playerID == null) return null;
  const candidates = buildScalarCandidates(playerID);
  if (!candidates.length) return null;

  const snapshots = await Promise.all(
    candidates.map(candidate =>
      db
        .collection("stats")
        .where("playerID", "==", candidate)
        .get()
    )
  );

  const docs = [];
  const seen = new Set();
  snapshots.forEach(snapshot => {
    snapshot.docs.forEach(docSnap => {
      if (seen.has(docSnap.id)) return;
      seen.add(docSnap.id);
      docs.push(docSnap);
    });
  });

  return selectBestStatsDoc(docs);
};

const fetchTeamByTeamId = async teamID => {
  if (teamID == null) return null;
  const directDoc = await db.collection("team").doc(String(teamID)).get();
  if (directDoc.exists) {
    return directDoc.data() || null;
  }

  const candidates = buildScalarCandidates(teamID);
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    const snapshot = await db
      .collection("team")
      .where("teamID", "==", candidate)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      return snapshot.docs[0].data() || null;
    }
  }

  return null;
};

const resolvePlayerEntryInMatch = ({ playersArr, player }) => {
  const playerID = player?.playerID;
  const playerNameKey = normalizeText(player?.name);
  return playersArr.find(entry => {
    const entryPlayerId = entry?.playerId ?? entry?.playerID;
    const idMatch = entryPlayerId != null && playerID != null && String(entryPlayerId) === String(playerID);
    if (idMatch) return true;
    if (!playerNameKey) return false;

    const canonicalName = normalizeText(entry?.canonicalName || entry?.name || entry?.abbrName);
    const name = normalizeText(entry?.name || "");
    const abbr = normalizeText(entry?.abbrName || "");
    return canonicalName === playerNameKey || name === playerNameKey || abbr === playerNameKey;
  });
};

const extractPlayerMatchData = async ({ player, team }) => {
  const matchesSnapshot = await db
    .collection(MATCHES_COL)
    .orderBy("date", "desc")
    .limit(MAX_PLAYER_CV_MATCH_SCAN)
    .get();

  const matchesPlayed = [];
  const gpsStats = [];

  matchesSnapshot.docs.forEach(docSnap => {
    const data = docSnap.data() || {};
    const playersArr = Array.isArray(data.players) ? data.players : [];
    const entry = resolvePlayerEntryInMatch({ playersArr, player });
    if (!entry) return;

    const minutesVal = entry.minutesPlayed ?? entry.minutes ?? entry.totalMinutes ?? 0;
    const positionVal = entry.position || entry.rolePlayed || entry.role || entry.pos || "";
    const gradeVal =
      entry.gameGrade?.overall10 ??
      entry.gameGrade?.overall ??
      entry.grade ??
      entry.rating ??
      null;

    const entryTeamId = entry.teamId ?? entry.teamID ?? null;
    const entrySide = entry.team || null;
    const playerTeamId = entryTeamId ?? player.teamID ?? player.teamId ?? null;
    const homeId = data.homeTeamId ?? data.homeTeamID ?? null;
    const awayId = data.awayTeamId ?? data.awayTeamID ?? null;
    const homeTeamName = data.homeTeam ?? "";
    const awayTeamName = data.awayTeam ?? "";
    const playerTeamName =
      entrySide === "home"
        ? homeTeamName
        : entrySide === "away"
          ? awayTeamName
          : player.teamName || team?.name || "";

    let opponentName = "";
    if (entrySide === "home") {
      opponentName = awayTeamName;
    } else if (entrySide === "away") {
      opponentName = homeTeamName;
    } else if (playerTeamId && (homeId || awayId)) {
      if (homeId && String(playerTeamId) === String(homeId)) opponentName = data.awayTeam;
      else if (awayId && String(playerTeamId) === String(awayId)) opponentName = data.homeTeam;
    }
    if (!opponentName && playerTeamName) {
      opponentName = data.homeTeam === playerTeamName ? data.awayTeam : data.homeTeam;
    }

    const gameLabel = opponentName ? `vs ${opponentName}` : `${data.homeTeam} vs ${data.awayTeam}`;
    matchesPlayed.push({
      id: docSnap.id,
      gameName: gameLabel,
      date: data.date || "",
      minutes: Number(minutesVal) || 0,
      position: positionVal || "-",
      grade: gradeVal != null ? Number(gradeVal) : null
    });

    if (entry.gps && typeof entry.gps === "object") {
      gpsStats.push(entry.gps);
    }
  });

  const numericValues = values =>
    values
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));
  const avg = values => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  const max = values => (values.length ? Math.max(...values) : null);

  const kmVals = numericValues(gpsStats.map(gps => gps.kmPer90));
  const speedVals = numericValues(gpsStats.map(gps => gps.topSpeedKmh));
  const bpmVals = numericValues(gpsStats.map(gps => gps.avgBpm));
  const sprintsVals = numericValues(gpsStats.map(gps => gps.sprints));

  const physicalMetrics = gpsStats.length
    ? {
        kmPer90: avg(kmVals),
        topSpeedKmh: max(speedVals),
        avgBpm: avg(bpmVals),
        avgSprints: avg(sprintsVals)
      }
    : null;

  return {
    matchesPlayed: matchesPlayed.slice(0, MAX_PLAYER_CV_MATCHES),
    physicalMetrics
  };
};

const canAccessPlayerCv = ({ requester, requestedPlayerDocId, playerTeamName }) => {
  if (!requester) return false;
  if (requester.role === "admin") return true;

  if (requester.role === "player") {
    if (!requester.playerDocId) return true;
    return String(requester.playerDocId) === String(requestedPlayerDocId);
  }

  if (requester.role === "manager") {
    const managerTeamKey = normalizeText(requester.teamName || requester.userTeam || "");
    const playerTeamKey = normalizeText(playerTeamName || "");
    if (managerTeamKey && playerTeamKey) {
      return managerTeamKey === playerTeamKey;
    }
    return true;
  }

  return false;
};

router.get("/player-cv/:playerDocId.pdf", async (req, res) => {
  try {
    const requester = await getRequesterContext(req);
    if (!requester) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const { playerDocId } = req.params;
    if (!playerDocId) {
      return res.status(400).json({ error: "playerDocId is required" });
    }

    const playerDoc = await db.collection("player").doc(playerDocId).get();
    if (!playerDoc.exists) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = playerDoc.data() || {};
    const team = await fetchTeamByTeamId(player.teamID);
    const playerTeamName = player.teamName || team?.name || null;

    if (!canAccessPlayerCv({ requester, requestedPlayerDocId: playerDocId, playerTeamName })) {
      return res.status(403).json({ error: "You do not have access to this player profile." });
    }

    const bestStats = await fetchBestStatsForPlayer(player.playerID);
    const stats = bestStats?.data || null;
    const { matchesPlayed, physicalMetrics } = await extractPlayerMatchData({ player, team });

    const scoutSnapshot =
      player?.insights?.scoutSnapshot ||
      player?.scoutSnapshot ||
      stats?.seasonGrade?.scoutSnapshot ||
      "";

    await streamPlayerCvPdf({
      res,
      player: { id: playerDocId, ...player },
      team,
      stats,
      scoutSnapshot,
      physicalMetrics,
      matchesPlayed
    });
  } catch (error) {
    console.error("Failed to generate player CV PDF:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Unable to generate player CV PDF." });
    }
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

  const resolvedDocs = new Map();
  const addResolvedDoc = docSnap => {
    if (!docSnap?.exists) return;
    resolvedDocs.set(docSnap.id, docSnap);
  };

  if (teamId != null) {
    const exactDoc = await db.collection("team").doc(String(teamId)).get();
    addResolvedDoc(exactDoc);
  }

  if (teamId != null) {
    const numericTeamId = parseNumericId(teamId);
    if (numericTeamId != null) {
      const snap = await db
        .collection("team")
        .where("teamID", "==", numericTeamId)
        .get();
      snap.docs.forEach(addResolvedDoc);
    }
  }

  if (typeof teamId === "string" && teamId.trim()) {
    const snap = await db
      .collection("team")
      .where("teamID", "==", teamId.trim())
      .get();
    snap.docs.forEach(addResolvedDoc);
  }

  const teamDocs = Array.from(resolvedDocs.values());
  const resolvedTeamDoc = teamDocs[0] || null;

  teamDocs.forEach(docSnap => {
    addCandidateId(ids, docSnap.id);
    addCandidateId(ids, docSnap.data()?.teamID);
  });

  return {
    idCandidates: Array.from(ids),
    teamDoc: resolvedTeamDoc,
    teamDocs
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

const normalizeReportLanguage = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return TEAM_REPORT_LANGUAGES.has(normalized) ? normalized : null;
};

const normalizePlayerInsightLanguage = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLAYER_INSIGHT_LANGUAGES.has(normalized) ? normalized : null;
};

router.post("/tactical-lineup", async (req, res) => {
  try {
    const payload = await generateTacticalPlan(req.body || {});
    return res.json(payload);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message =
      status >= 500
        ? "Could not build tactical lineup recommendation."
        : error?.message || "Invalid tactical lineup payload.";
    if (status >= 500) {
      console.error("Failed to build tactical lineup recommendation:", error);
    }
    return res.status(status).json({ error: message });
  }
});

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

const getStoredTeamReportLanguage = teamData => {
  const stored = teamData?.[TEAM_REPORT_FIELD];
  if (!stored || typeof stored !== "object") return null;

  if (isStoredReportBody(stored)) {
    return (
      normalizeReportLanguage(stored.reportLanguage) ||
      normalizeReportLanguage(stored.language)
    );
  }

  if (isStoredReportBody(stored.report)) {
    return (
      normalizeReportLanguage(stored.reportLanguage) ||
      normalizeReportLanguage(stored.language) ||
      normalizeReportLanguage(stored.report?.reportLanguage) ||
      normalizeReportLanguage(stored.report?.language)
    );
  }

  return null;
};

const getStoredTeamReportPayload = ({ teamData, teamId, teamName }) => {
  const stored = teamData?.[TEAM_REPORT_FIELD];
  if (!stored || typeof stored !== "object") return null;

  if (isStoredReportBody(stored)) {
    return {
      teamId,
      teamName,
      reportLanguage:
        normalizeReportLanguage(stored.reportLanguage) ||
        normalizeReportLanguage(stored.language) ||
        DEFAULT_TEAM_REPORT_LANGUAGE,
      report: stored
    };
  }

  if (isStoredReportBody(stored.report)) {
    return {
      teamId: stored.teamId ?? teamId,
      teamName: stored.teamName ?? teamName,
      reportLanguage:
        normalizeReportLanguage(stored.reportLanguage) ||
        normalizeReportLanguage(stored.language) ||
        normalizeReportLanguage(stored.report?.reportLanguage) ||
        normalizeReportLanguage(stored.report?.language) ||
        DEFAULT_TEAM_REPORT_LANGUAGE,
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
  reportLanguage = DEFAULT_TEAM_REPORT_LANGUAGE,
  supplementalInsights = []
}) => {
  const normalizedReportLanguage =
    normalizeReportLanguage(reportLanguage) || DEFAULT_TEAM_REPORT_LANGUAGE;
  const matches = await fetchMatchesForTeam({ teamIds: idCandidates, teamName });
  const report = await generateTeamReport({
    matches,
    teamId: idCandidates[0] ?? teamId,
    teamName,
    maxMatches: 10,
    language: normalizedReportLanguage,
    supplementalInsights: normalizeSupplements(supplementalInsights)
  });

  const payload = {
    teamId,
    teamName,
    generatedAt: new Date(),
    reportLanguage: normalizedReportLanguage,
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

    const { idCandidates, teamDoc, teamDocs = [] } = await normalizeIdCandidates(teamId);
    if (!teamDoc) {
      return res.status(404).json({ error: "Team not found" });
    }

    const teamData = teamDoc.data() || {};
    const teamName = teamData.name ?? null;
    const docsToCheck = teamDocs.length ? teamDocs : [teamDoc];

    let storedPayload = null;
    let storedSourceData = null;
    for (const docSnap of docsToCheck) {
      const candidateData = docSnap.data() || {};
      const candidatePayload = getStoredTeamReportPayload({
        teamData: candidateData,
        teamId,
        teamName: candidateData.name ?? teamName
      });
      if (candidatePayload) {
        storedPayload = candidatePayload;
        storedSourceData = candidateData;
        break;
      }
    }

    if (storedPayload) {
      return res.json(storedPayload);
    }

    const supplementalInsights = getStoredSupplements(storedSourceData || teamData);
    const reportLanguage =
      getStoredTeamReportLanguage(storedSourceData || teamData) ||
      DEFAULT_TEAM_REPORT_LANGUAGE;

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      idCandidates,
      teamName,
      reportLanguage,
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
    const requestedLanguage =
      typeof req.body?.language === "string" ? req.body.language : null;
    const normalizedLanguage = normalizeReportLanguage(requestedLanguage);
    if (requestedLanguage && !normalizedLanguage) {
      return res.status(400).json({ error: "language must be one of: en, ro" });
    }
    const reportLanguage =
      normalizedLanguage ||
      getStoredTeamReportLanguage(teamData) ||
      DEFAULT_TEAM_REPORT_LANGUAGE;

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
      reportLanguage,
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
    const requestedLanguage =
      typeof req.body?.language === "string" ? req.body.language : null;
    const normalizedLanguage = normalizeReportLanguage(requestedLanguage);
    if (requestedLanguage && !normalizedLanguage) {
      return res.status(400).json({ error: "language must be one of: en, ro" });
    }
    const reportLanguage =
      normalizedLanguage ||
      getStoredTeamReportLanguage(teamData) ||
      DEFAULT_TEAM_REPORT_LANGUAGE;

    const payload = await buildAndPersistTeamReport({
      teamId,
      teamDoc,
      idCandidates,
      teamName,
      reportLanguage,
      supplementalInsights
    });

    return res.json(payload);
  } catch (error) {
    console.error("Failed to regenerate team report:", error);
    return res.status(500).json({ error: "Could not regenerate team report." });
  }
});

export default router;
