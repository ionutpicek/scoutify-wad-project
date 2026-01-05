export function generateFallbackScoutVerdict(grade) {
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

  return `
Season evaluation for a ${grade.role.toLowerCase()}.
The player shows strong qualities in ${strengthsText}, contributing effectively within their role.
Areas for improvement include ${weaknessesText}, which could be refined with targeted development.
Overall, the player fits well within their positional responsibilities and offers reliable performances across the season.
`.trim();
}
