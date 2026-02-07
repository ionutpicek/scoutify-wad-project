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
- Include exactly one number per card, and label it. Format the number field as "Stat label: value" (e.g., "xG/90: 0.17" or "Shots on target: 1.4").
- Use either raw totals or derived per90/percentages and keep the narrative focused on tendencies.
- “what_it_looks_like” must describe a repeatable pattern drawn from the data.
- “coaching_cue” must be one actionable instruction (e.g., “Emphasize…” or “Look to…”).
- Restrict roles to this list: Classic 10, Advanced 8, Two-way Attacking Midfielder, Box-to-Box 8, Deep-lying Playmaker, Regista, Mezzala, Carrilero, Segundo Volante, Half-Back, Anchor 6, Destroyer, Ball-winning Midfielder, Wide Playmaker, Inverted Winger, Traditional Winger, Inside Forward, Wide Forward, Wide Target Forward, Pressing Forward, Target Forward, Poacher, False 9, Complete Forward, Advanced Forward, Trequartista, Second Striker, Shadow Striker, Raumdeuter, Centre Back, Ball-Playing Center Back, Stopper, Sweeper, Fullback, Inverted Fullback, Wingback, Defensive Fullback, Overlapping Fullback, Underlapping Fullback, Wide Center Back. Mention multiple roles if it helps clarify the profile.
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
  const progressionStyle = role.toLowerCase().includes("mid")
    ? "medium-progressive"
    : "safe";

  return JSON.stringify({
    role_title: `${role} profile${gradeLabel}`,
    summary_text: `${player?.name || "This player"} (${age ?? "N/A"}) at ${teamName}. ${strengthLine} ${weaknessLine}`,
    cards: [
      {
        heading: "Offensive",
        narrative: strengthLine,
        number: `Minutes: ${minutes}`,
        what_it_looks_like: "Gets involved when team attacks and supports final-third actions.",
        coaching_cue: "Emphasize quick support runs after first pass forward."
      },
      {
        heading: "Passing profile",
        narrative: `Prefers ${progressionStyle} passing with an eye for progression.`,
        number: `Matches: ${games}`,
        what_it_looks_like: "Looks for forward options when body shape is open.",
        coaching_cue: "Look to play forward earlier when central lanes open."
      },
      {
        heading: "Dribbling",
        narrative: role.toLowerCase().includes("mid")
          ? "Uses dribbles to break lines."
          : "Comfortable keeping the ball moving.",
        number: `Age: ${age ?? "N/A"}`,
        what_it_looks_like: "Carries into available space before releasing the ball.",
        coaching_cue: "Emphasize first touch into space to create acceleration."
      },
      {
        heading: "Defensive",
        narrative: weaknessLine,
        number: grade != null ? `Overall grade: ${grade.toFixed(1)}/10` : "Overall grade: N/A",
        what_it_looks_like: "Defensive contribution depends on role and field zone.",
        coaching_cue: "Look to recover shape earlier after possession losses."
      },
      {
        heading: "Strengths",
        narrative: `Balanced activity between possession and recovery, especially linked to ${strengths[0] || "general work rate"}.`,
        number: `Top trait count: ${strengths.length}`,
        what_it_looks_like: "Shows repeatable positive actions in primary role tasks.",
        coaching_cue: "Emphasize repeating strongest actions in high-value zones."
      },
      {
        heading: "Development",
        narrative:
          "Keep refining decision-making in high-pressure scenarios and continue improving shot choice.",
        number: `Watch areas: ${weaknesses.length}`,
        what_it_looks_like: "Decision quality drops when tempo and pressure increase.",
        coaching_cue: "Look to simplify first action under pressure before forcing progression."
      },
      {
        heading: "Conclusion",
        narrative: `A ${role.toLowerCase()} profile that combines energy with measured progression for ${teamName}.`,
        number: `Role confidence: ${Math.round((stats?.seasonGrade?.roleConfidence || 0) * 100)}%`,
        what_it_looks_like: "Profile fits best in a structure that values balanced two-way involvement.",
        coaching_cue: "Emphasize role clarity and repeatable decision patterns week to week."
      }
    ]
  });
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
