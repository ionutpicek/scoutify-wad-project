import { db } from "../firebase/firebaseAdmin.js";
import { generateScoutVerdict } from "../ai/scoutVerdict.js";
import admin from "firebase-admin";

const DEFAULT_PLAYER_INSIGHT_LANGUAGE = "en";
const PLAYER_INSIGHT_LANGUAGES = new Set(["en", "ro"]);

const normalizePlayerInsightLanguage = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLAYER_INSIGHT_LANGUAGES.has(normalized) ? normalized : null;
};

/**
 * Attach (or regenerate) AI scout verdict on one stats document
 * @param {string} statsDocId
 */
export async function attachAIScoutVerdict(statsDocId, { language } = {}) {
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

  const verdictLanguage =
    normalizePlayerInsightLanguage(language) ||
    normalizePlayerInsightLanguage(grade?.aiVerdictLanguage) ||
    DEFAULT_PLAYER_INSIGHT_LANGUAGE;
  const aiVerdict = await generateScoutVerdict(grade, derived, { language: verdictLanguage });

  await ref.update({
    "seasonGrade.aiVerdict": aiVerdict,
    "seasonGrade.aiGeneratedAt": admin.firestore.FieldValue.serverTimestamp(),
    "seasonGrade.aiVerdictLanguage": verdictLanguage,
  });

  return { aiVerdict, language: verdictLanguage };
}

export default attachAIScoutVerdict;
