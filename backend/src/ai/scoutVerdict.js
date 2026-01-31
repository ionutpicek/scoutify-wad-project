import OpenAI from "openai";
import { generateFallbackScoutVerdict } from "./fallbackScoutVerdict.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function generateScoutVerdict(grade) {
  if (!openai) {
    return generateFallbackScoutVerdict(grade);
  }

  try {
    const isGoalkeeper =
      grade.role?.toLowerCase().includes("goalkeeper") ||
      grade.role === "GK";

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

Write a concise scouting verdict of 4–6 sentences.
Use professional football terminology.
Do NOT mention numbers, ratings, or percentages.
Do NOT repeat the input data verbatim.
`;

    const res = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.35,
    });

    return res.choices[0].message.content.trim();
  } catch (err) {
    console.warn("OpenAI failed, using fallback:", err.message);
    return generateFallbackScoutVerdict(grade);
  }
}
