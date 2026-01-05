function pickDerivedForPrompt(derived, role) {
  if (!derived) return {};

  if (role === "GOALKEEPER") {
    return {
      saves_p90: derived.saves_p90,
      goalsConceded_p90: derived.goalsConceded_p90,
      saveRate: derived.saveRate,
      longPassAccuracy: derived.longPassAccuracy,
    };
  }

  return {
    goals_p90: derived.goals_p90,
    assists_p90: derived.assists_p90,
    xG_p90: derived.xG_p90,
    xA_p90: derived.xA_p90,
    progressiveRuns_p90: derived.progressiveRuns_p90,
    duelsWonPct: derived.duelsWonPct,
    passAccuracy: derived.passAccuracy,
  };
}

function humanizeStat(key) {
  return key
    .replace(/_p90/g, " per 90")
    .replace(/Pct/g, " %")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase());
}

function formatStat(value) {
  if (value == null) return "N/A";
  if (typeof value === "number") {
    if (value <= 1) return (value * 100).toFixed(0) + "%";
    return value.toFixed(2);
  }
  return value;
}


export function buildScoutPrompt(grade, derived) {
  const {
    role,
    secondaryRole,
    overall10,
    confidence,
    subGrades
  } = grade;

  const selectedDerived = pickDerivedForPrompt(derived, role);

  return `
You are a professional football scout.

PLAYER EVALUATION
Role: ${role}
Secondary role: ${secondaryRole || "None"}
Overall grade: ${overall10.toFixed(1)} / 10
Confidence level: ${Math.round(confidence * 100)}%

SUB-GRADES
${Object.entries(subGrades)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

STATISTICAL PROFILE (per 90 / efficiency)
${Object.entries(selectedDerived)
  .map(([k, v]) => `- ${humanizeStat(k)}: ${formatStat(v)}`)
  .join("\n")}

INSTRUCTIONS
- Write 3–4 concise sentences
- Base the verdict strictly on the information above
- Mention strengths and weaknesses
- Reflect reliability based on confidence
- Avoid hype, absolutes, or invented data
- Do NOT mention exact numbers
`;
}
