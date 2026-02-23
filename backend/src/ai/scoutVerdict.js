import OpenAI from "openai";
import { generateFallbackScoutVerdict } from "./fallbackScoutVerdict.js";

const DEFAULT_PLAYER_INSIGHT_LANGUAGE = "en";
const PLAYER_INSIGHT_LANGUAGE_META = {
  en: { label: "English" },
  ro: { label: "Romanian" },
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const normalizePlayerInsightLanguage = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLAYER_INSIGHT_LANGUAGE_META[normalized] ? normalized : null;
};

export async function generateScoutVerdict(grade, _derived, { language } = {}) {
  const normalizedLanguage =
    normalizePlayerInsightLanguage(language) || DEFAULT_PLAYER_INSIGHT_LANGUAGE;

  if (!openai) {
    return generateFallbackScoutVerdict(grade, { language: normalizedLanguage });
  }

  try {
    const isGoalkeeper =
      grade.role?.toLowerCase().includes("goalkeeper") || grade.role === "GK";

    const prompt = `
You are a professional football scout writing an internal scouting report.

Primary role: ${grade.role}
Secondary role: ${grade.secondaryRole || "None"}

Player profile data:
${JSON.stringify(grade.subGrades)}

${
  isGoalkeeper
    ? `
Focus specifically on goalkeeping qualities:
- Shot-stopping and reflexes
- Positioning and command of the penalty area
- Decision-making under pressure
- Distribution and involvement in buildup play
`
    : `
Focus specifically on:
- Technical quality and tactical intelligence
- Contribution in and out of possession
- Suitability to the listed role(s)
- Areas that may require development
`
}

Write a concise scouting verdict of 4-6 sentences.
Use professional football terminology.
Use ${PLAYER_INSIGHT_LANGUAGE_META[normalizedLanguage]?.label || PLAYER_INSIGHT_LANGUAGE_META[DEFAULT_PLAYER_INSIGHT_LANGUAGE].label}.
Do NOT mention numbers, ratings, or percentages.
Do NOT repeat the input data verbatim.
`.trim();

    const res = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.35,
    });

    return res.choices?.[0]?.message?.content?.trim() || generateFallbackScoutVerdict(grade, { language: normalizedLanguage });
  } catch (err) {
    console.warn("OpenAI failed, using fallback:", err.message);
    return generateFallbackScoutVerdict(grade, { language: normalizedLanguage });
  }
}
