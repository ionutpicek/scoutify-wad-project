import OpenAI from "openai";
import { pickDerivedForPrompt, humanizeStat, formatStat } from "./scoutPrompt.js";

const MODEL_NAME = "gpt-5.2";
let openai = null;

const getOpenAI = () => {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key) {
      console.log("OpenAI API key: Configured");
      openai = new OpenAI({ apiKey: key });
    } else {
      console.log("OpenAI API key: Not configured");
    }
  }
  return openai;
};

const calculateAge = (value) => {
  if (!value) return null;
  let birthDate;
  if (typeof value.toDate === "function") {
    birthDate = value.toDate();
  } else {
    birthDate = new Date(value);
  }
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  return age;
};

const subGradesSummary = (subGrades = {}) => {
  const entries = Object.entries(subGrades);
  if (!entries.length) return { strengths: [], weaknesses: [] };
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const strengths = sorted.slice(0, 3).map(([key]) => key);
  const weaknesses = sorted.slice(-3).map(([key]) => key);
  return { strengths, weaknesses };
};

const buildDerivedList = (stats) => {
  const derived = pickDerivedForPrompt(stats?.derived || {});
  const entries = Object.entries(derived)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `- ${humanizeStat(key)}: ${formatStat(value)}`);
  return entries.length ? entries.join("\n") : "- Not enough per90 data.";
};

const buildPrompt = ({ player, team, stats }) => {
  const age = calculateAge(player?.birthdate) ?? "N/A";
  const role =
    (stats?.seasonGrade?.role || player?.position || "Unknown").toString();
  const foot =
    player?.preferredFoot || player?.foot || player?.preferred_foot || "Unknown";
  const minutes = stats?.minutes ?? stats?.minutesPlayed ?? "N/A";
  const games = stats?.games ?? stats?.appearances ?? "N/A";
  const overallGrade =
    stats?.seasonGrade?.overall10 != null
      ? Number(stats.seasonGrade.overall10).toFixed(1)
      : "N/A";
  const teamName = team?.name || "Unknown team";
  const nationality = player?.nationality || player?.country || "Romania";
  const derivedList = buildDerivedList(stats);
  const subGrades = stats?.seasonGrade?.subGrades || {};
  const gradeLines = Object.entries(subGrades)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  const physical =
    stats?.physicalMetrics ||
    stats?.physical ||
    stats?.gps ||
    stats?.gpsMetrics ||
    {};
  const physicalLines = [];
  if (physical.kmPer90 != null) {
    physicalLines.push(`- km/90: ${Number(physical.kmPer90).toFixed(2)}`);
  }
  if (physical.topSpeedKmh != null) {
    physicalLines.push(`- top speed: ${Number(physical.topSpeedKmh).toFixed(1)} km/h`);
  }
  if (physical.avgBpm != null) {
    physicalLines.push(`- avg bpm: ${Number(physical.avgBpm).toFixed(0)}`);
  }
  if (physical.sprints != null) {
    physicalLines.push(`- sprints: ${Number(physical.sprints).toFixed(0)}`);
  }
  const physicalText = physicalLines.length ? physicalLines.join("\n") : "- Physical metrics not available.";
  const roleConfidence =
    stats?.seasonGrade?.roleConfidence != null
      ? ` (${Math.round(stats.seasonGrade.roleConfidence * 100)}% confidence)`
      : "";
  const roleDescriptor = `${role}${roleConfidence}`;

  return `

Create a role-based insight panel and return ONLY JSON that matches the schema:
{
  "role_title": string,
  "summary_text": string,
  "cards": [
    {
      "heading": string,
      "narrative": string,
      "number": string,
      "what_it_looks_like": string,
      "coaching_cue": string
    }
  ]
}

PLAYER DATA:
Bio: name=${player?.name || "Unknown"}, age=${age}, minutes=${minutes}, matches=${games}, team=${teamName}
Positions played: ${role}

RAW TOTALS:
${JSON.stringify(stats?.rawTotals || {}, null, 2)}

DERIVED METRICS (per90 and % already computed):
${JSON.stringify(stats?.derived || {}, null, 2)}

PHYSICAL/GPS METRICS:
${physicalText}

Important:
- Include exactly one number per card (either from raw totals or derived per90 percentages) and keep the rest of the sentence focused on tendencies.
- “what_it_looks_like” must describe a repeatable pattern drawn from the data.
- “coaching_cue” must be one actionable instruction (e.g., “Emphasize…” or “Look to…”).
- Restrict roles to this list: Classic 10, Advanced 8, Two-way Attacking Midfielder, Box-to-Box 8, Deep-lying Playmaker, Anchor 6, Ball-winning Midfielder, Wide Playmaker, Winger, Inside Forward, Pressing Forward, Target Forward. Mention multiple roles if it helps clarify the profile.
- Keep the JSON clean—no markdown bullets, emphasis markers, or extra commentary outside the schema.
- Rely on derived metrics for justification instead of repeating the raw numbers already visible in the UI.

Use the data to craft concise insights for the headings: Offensive, Passing profile, Dribbling, Defensive, Strengths, Development, Conclusion.
`
    .trim();
};

const fallbackSummary = ({ player, team, stats }) => {
  const age = calculateAge(player?.birthdate);
  const role =
    (stats?.seasonGrade?.role || player?.position || "Unknown").toString();
  const teamName = team?.name || "Unknown team";
  const minutes = stats?.minutes ?? stats?.minutesPlayed ?? 0;
  const games = stats?.games ?? stats?.appearances ?? 0;
  const grade = stats?.seasonGrade?.overall10 ?? null;
  const { strengths, weaknesses } = subGradesSummary(stats?.seasonGrade?.subGrades);
  const strengthLine = strengths.length
    ? `Excels in ${strengths.join(", ")}.`
    : "Shows reliable foundational work.";
  const weaknessLine = weaknesses.length
    ? `Areas to watch: ${weaknesses.join(", ")}.`
    : "No glaring weaknesses recorded yet.";
  const gradeLabel = grade ? ` (${grade.toFixed(1)}/10)` : "";

  const fallbackRoleTitle = `Role title: ${role} profile${gradeLabel}`;

  return [
    fallbackRoleTitle,
    "Offensive",
    `- ${strengthLine}`,
    "Passing profile",
    `- Prefers ${
      role.toLowerCase().includes("mid") ? "medium-progressive" : "safe"
    } passing with an eye for progression.`,
    "Dribbling",
    `- ${
      role.toLowerCase().includes("mid") ? "Uses dribbles to break lines" : "Comfortable keeping the ball moving"
    }.`,
    "Defensive",
    `- ${weaknessLine}`,
    "Strengths",
    `- Balanced activity between possession and recovery, especially linked to ${
      strengths[0] || "general work rate"
    }.`,
    "Development",
    "- Keep refining decision-making in high-pressure scenarios and continue improving shot choice.",
    "Conclusion",
    `- A ${role.toLowerCase()} profile that combines energy with measured progression for ${teamName}.`,
  ].join("\n");
};

export async function generatePlayerProfileSummary({ player, team, stats }) {
  const prompt = buildPrompt({ player, team, stats });

  const client = getOpenAI();
  if (!client) {
    console.log("OpenAI API key not configured, using fallback summary.");
    return fallbackSummary({ player, team, stats });
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content:
            "You are a professional football scout. Keep insights structured, clear and data-driven.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
    });

    const message = response?.choices?.[0]?.message?.content?.trim();
    if (message) return message;
  } catch (error) {
    console.warn("AI profile summary failed, falling back:", error.message || error);
  }

  return fallbackSummary({ player, team, stats });
}

export default generatePlayerProfileSummary;
