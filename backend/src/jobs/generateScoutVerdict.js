import { db } from "../firebase/firebaseAdmin.js";
import { generateScoutVerdict } from "../ai/scoutVerdict.js";
import admin from "firebase-admin";

/**
 * Attach (or regenerate) AI scout verdict on one stats document
 * @param {string} statsDocId
 */
export async function attachAIScoutVerdict(statsDocId) {
  const ref = db.collection("stats").doc(statsDocId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("Stats document not found");
  }

  const stats = snap.data();
  const grade = stats.seasonGrade;
  const derived = stats.derived;

  if (!grade) {
    throw new Error("Season grade missing");
  }

  const aiVerdict = await generateScoutVerdict(grade, derived);

  await ref.update({
    "seasonGrade.aiVerdict": aiVerdict,
    "seasonGrade.aiGeneratedAt": admin.firestore.FieldValue.serverTimestamp(),
  });

  return { aiVerdict };
}

export default attachAIScoutVerdict;
