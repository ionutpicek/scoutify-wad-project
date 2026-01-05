// src/matches/loadSeasonGrades.js
import { db } from "../firebase/firebaseAdmin.js";

export async function loadSeasonGrades(playerIds) {
  const map = {};

  if (!playerIds?.length) return map;

  const uniqueIds = [...new Set(playerIds)].filter(Boolean);

  for (const playerId of uniqueIds) {
    const snap = await db
      .collection("stats")
      .where("playerID", "==", playerId)
      .limit(1)
      .get();

    if (!snap.empty) {
      const data = snap.docs[0].data();
      if (data.seasonGrade) {
        map[playerId] = data.seasonGrade;
      }
    }
  }

  return map;
}
