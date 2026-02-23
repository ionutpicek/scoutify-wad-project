const DEFAULT_PLAYER_INSIGHT_LANGUAGE = "en";
const PLAYER_INSIGHT_LANGUAGES = new Set(["en", "ro"]);

const normalizePlayerInsightLanguage = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PLAYER_INSIGHT_LANGUAGES.has(normalized) ? normalized : null;
};

export function generateFallbackScoutVerdict(grade, { language } = {}) {
  const normalizedLanguage =
    normalizePlayerInsightLanguage(language) || DEFAULT_PLAYER_INSIGHT_LANGUAGE;
  const strengths = [];
  const weaknesses = [];

  for (const [key, value] of Object.entries(grade.subGrades || {})) {
    if (value >= 70) strengths.push(key);
    if (value <= 45) weaknesses.push(key);
  }

  const strengthsText =
    strengths.length > 0
      ? strengths.join(", ")
      : "overall contribution";

  const weaknessesText =
    weaknesses.length > 0
      ? weaknesses.join(", ")
      : "minor consistency aspects";

  if (normalizedLanguage === "ro") {
    return `
Evaluare de sezon pentru un ${grade.role.toLowerCase()}.
Jucatorul arata calitati bune la ${strengthsText}, cu aport clar in rolul sau.
Zone de imbunatatit: ${weaknessesText}, care pot creste prin lucru specific.
Per total, profilul se potriveste cerintelor pozitiei si ofera un nivel constant pe parcursul sezonului.
`.trim();
  }

  return `
Season evaluation for a ${grade.role.toLowerCase()}.
The player shows strong qualities in ${strengthsText}, contributing effectively within their role.
Areas for improvement include ${weaknessesText}, which could be refined with targeted development.
Overall, the player fits well within their positional responsibilities and offers reliable performances across the season.
`.trim();
}
