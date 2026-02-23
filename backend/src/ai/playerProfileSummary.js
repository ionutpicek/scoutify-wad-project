import OpenAI from "openai";
import { pickDerivedForPrompt, humanizeStat, formatStat } from "./scoutPrompt.js";

const MODEL_NAME = "gpt-5.2";
const DEFAULT_PLAYER_INSIGHT_LANGUAGE = "en";
const PLAYER_INSIGHT_LANGUAGE_META = {
  en: { label: "English" },
  ro: { label: "Romanian" },
};
const FIXED_HEADINGS = [
  "Offensive",
  "Passing profile",
  "Dribbling",
  "Defensive",
  "Strengths",
  "Development",
  "Conclusion",
];

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

const normalizePlayerInsightLanguage = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLAYER_INSIGHT_LANGUAGE_META[normalized] ? normalized : null;
};

const calculateAge = value => {
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
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
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

const buildDerivedList = stats => {
  const derived = pickDerivedForPrompt(stats?.derived || {});
  const entries = Object.entries(derived)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `- ${humanizeStat(key)}: ${formatStat(value)}`);
  return entries.length ? entries.join("\n") : "- Not enough per90 data.";
};

const buildPrompt = ({ player, team, stats, language = DEFAULT_PLAYER_INSIGHT_LANGUAGE }) => {
  const age = calculateAge(player?.birthdate) ?? "N/A";
  const role = (stats?.seasonGrade?.role || player?.position || "Unknown").toString();
  const minutes = stats?.minutes ?? stats?.minutesPlayed ?? "N/A";
  const games = stats?.games ?? stats?.appearances ?? "N/A";
  const teamName = team?.name || "Unknown team";

  const physical =
    stats?.physicalMetrics || stats?.physical || stats?.gps || stats?.gpsMetrics || {};
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
  const physicalText =
    physicalLines.length ? physicalLines.join("\n") : "- Physical metrics not available.";

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

DERIVED METRICS LIST:
${buildDerivedList(stats)}

PHYSICAL/GPS METRICS:
${physicalText}

Important:
- Include exactly one number per card, and label it as "Stat label: value".
- Use either raw totals or derived per90/percentages and keep narrative focused on tendencies.
- "what_it_looks_like" must describe a repeatable pattern drawn from the data.
- "coaching_cue" must be one actionable instruction.
- Write all free-text fields in ${PLAYER_INSIGHT_LANGUAGE_META[language]?.label || PLAYER_INSIGHT_LANGUAGE_META[DEFAULT_PLAYER_INSIGHT_LANGUAGE].label}.
- Keep each cards[].heading exactly in English and in this set: ${FIXED_HEADINGS.join(", ")}.
- Do not mix languages in free-text fields.
- Keep JSON clean: no markdown, no extra commentary outside schema.
- Rely on derived metrics for justification instead of repeating raw numbers already visible in the UI.
`;
};

const fallbackSummaryEnglish = ({ player, team, stats }) => {
  const age = calculateAge(player?.birthdate);
  const role = (stats?.seasonGrade?.role || player?.position || "Unknown").toString();
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

const fallbackSummaryRomanian = ({ player, team, stats }) => {
  const age = calculateAge(player?.birthdate);
  const role = (stats?.seasonGrade?.role || player?.position || "Unknown").toString();
  const teamName = team?.name || "Unknown team";
  const minutes = stats?.minutes ?? stats?.minutesPlayed ?? 0;
  const games = stats?.games ?? stats?.appearances ?? 0;
  const grade = stats?.seasonGrade?.overall10 ?? null;
  const { strengths, weaknesses } = subGradesSummary(stats?.seasonGrade?.subGrades);
  const strengthLine = strengths.length
    ? `Iese in evidenta la ${strengths.join(", ")}.`
    : "Arata o baza solida in sarcinile principale.";
  const weaknessLine = weaknesses.length
    ? `Zone de imbunatatit: ${weaknesses.join(", ")}.`
    : "Nu apar slabiciuni majore in esantionul curent.";
  const gradeLabel = grade ? ` (${grade.toFixed(1)}/10)` : "";
  const progressionStyle = role.toLowerCase().includes("mid") ? "progresiv" : "sigur";

  return JSON.stringify({
    role_title: `Profil ${role}${gradeLabel}`,
    summary_text: `${player?.name || "Acest jucator"} (${age ?? "N/A"}) la ${teamName}. ${strengthLine} ${weaknessLine}`,
    cards: [
      {
        heading: "Offensive",
        narrative: strengthLine,
        number: `Minute: ${minutes}`,
        what_it_looks_like: "Se implica in fazele ofensive si sustine actiunile din treimea finala.",
        coaching_cue: "Accentueaza cursele de sustinere dupa prima pasa verticala."
      },
      {
        heading: "Passing profile",
        narrative: `Prefera un stil ${progressionStyle} de pasare, cu intentie de progresie.`,
        number: `Meciuri: ${games}`,
        what_it_looks_like: "Cauta optiuni inainte cand orientarea corpului permite.",
        coaching_cue: "Cauta pasa verticala mai devreme cand culoarele centrale sunt deschise."
      },
      {
        heading: "Dribbling",
        narrative: role.toLowerCase().includes("mid")
          ? "Foloseste driblingul pentru a rupe linii."
          : "Gestioneaza bine mingea in progresie.",
        number: `Varsta: ${age ?? "N/A"}`,
        what_it_looks_like: "Conduce mingea in spatiu liber inainte de pasa.",
        coaching_cue: "Accentueaza primul control in spatiu pentru accelerare."
      },
      {
        heading: "Defensive",
        narrative: weaknessLine,
        number: grade != null ? `Nota generala: ${grade.toFixed(1)}/10` : "Nota generala: N/A",
        what_it_looks_like: "Contributia defensiva variaza in functie de rol si zona.",
        coaching_cue: "Recupereaza forma defensiva mai devreme dupa pierderea posesiei."
      },
      {
        heading: "Strengths",
        narrative: `Activitate echilibrata intre posesie si recuperare, mai ales la ${strengths[0] || "munca fara minge"}.`,
        number: `Numar puncte forte: ${strengths.length}`,
        what_it_looks_like: "Repeta actiuni pozitive in sarcinile principale ale rolului.",
        coaching_cue: "Repeta actiunile forte in zonele cu impact mare."
      },
      {
        heading: "Development",
        narrative:
          "Poate creste prin decizii mai bune in presiune ridicata si selectie mai buna a finalizarii.",
        number: `Zone de lucru: ${weaknesses.length}`,
        what_it_looks_like: "Calitatea deciziei scade cand ritmul si presiunea cresc.",
        coaching_cue: "Simplifica prima actiune sub presiune inainte de progresie fortata."
      },
      {
        heading: "Conclusion",
        narrative: `Profil de ${role.toLowerCase()} cu energie si progresie controlata pentru ${teamName}.`,
        number: `Incredere rol: ${Math.round((stats?.seasonGrade?.roleConfidence || 0) * 100)}%`,
        what_it_looks_like: "Se potriveste intr-o structura care cere implicare in ambele faze.",
        coaching_cue: "Mentine claritatea rolului si tiparele de decizie de la meci la meci."
      }
    ]
  });
};

const fallbackSummaryByLanguage = ({ player, team, stats, language }) => {
  const normalized =
    normalizePlayerInsightLanguage(language) || DEFAULT_PLAYER_INSIGHT_LANGUAGE;
  if (normalized === "ro") {
    return fallbackSummaryRomanian({ player, team, stats });
  }
  return fallbackSummaryEnglish({ player, team, stats });
};

export async function generatePlayerProfileSummary({ player, team, stats, language } = {}) {
  const normalizedLanguage =
    normalizePlayerInsightLanguage(language) || DEFAULT_PLAYER_INSIGHT_LANGUAGE;
  const prompt = buildPrompt({ player, team, stats, language: normalizedLanguage });

  const client = getOpenAI();
  if (!client) {
    console.log("OpenAI API key not configured, using fallback summary.");
    return fallbackSummaryByLanguage({ player, team, stats, language: normalizedLanguage });
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: `You are a professional football scout. Keep insights structured, clear and data-driven. Use ${PLAYER_INSIGHT_LANGUAGE_META[normalizedLanguage]?.label || PLAYER_INSIGHT_LANGUAGE_META[DEFAULT_PLAYER_INSIGHT_LANGUAGE].label} for all free-text fields.`,
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

  return fallbackSummaryByLanguage({ player, team, stats, language: normalizedLanguage });
}

export default generatePlayerProfileSummary;
