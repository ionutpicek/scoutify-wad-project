import admin from "firebase-admin";
import { db } from "../firebase/firebaseAdmin.js";
import { gradeGame } from "./gameGrade.js";
import { gradeGameGK } from "./gradeGK.js";
import { pickBestPerformers } from "./pickBestPerformer.js";

const MATCHES_COL = "matches";
const MIN_MINUTES_FOR_GRADE_OUTFIELD = 30;
const MIN_MINUTES_FOR_GRADE_GK = 45;
const DEFAULT_PAGE_SIZE = 200;

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

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function recomputeAllGameGrades({ dryRun = false, limit = null, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const hardLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : null;
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, 450));
  const isDryRun = toBool(dryRun);

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let cursor = null;

  while (true) {
    const remaining = hardLimit == null ? safePageSize : Math.max(hardLimit - scanned, 0);
    if (remaining <= 0) break;

    let query = db
      .collection(MATCHES_COL)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(Math.min(safePageSize, remaining));

    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    let pageUpdates = 0;

    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data() || {};
      const players = Array.isArray(data.players) ? data.players : [];
      if (!players.length) {
        skipped += 1;
        continue;
      }

      const regradedPlayers = regradePlayers(players);
      const bestPerformers = pickBestPerformers(regradedPlayers);

      if (!isDryRun) {
        batch.set(
          docSnap.ref,
          {
            players: regradedPlayers,
            bestPerformers,
            bestPerformer: bestPerformers,
            gameGradesUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      updated += 1;
      pageUpdates += 1;
    }

    if (!isDryRun && pageUpdates > 0) {
      await batch.commit();
    }

    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < Math.min(safePageSize, remaining)) break;
  }

  return {
    dryRun: isDryRun,
    scanned,
    updated,
    skipped
  };
}
