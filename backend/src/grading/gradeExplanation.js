const band = (v) => {
  if (v >= 75) return "excellent";
  if (v >= 60) return "good";
  if (v >= 45) return "average";
  if (v >= 30) return "below average";
  return "poor";
};

export function generateSeasonExplanation(seasonGrade) {
  if (!seasonGrade || seasonGrade.overall10 == null) {
    return "Not enough comparable data to generate a season evaluation.";
  }

  const { role, overall10, confidence, subGrades } = seasonGrade;

  const lines = [];

  // Role intro
  lines.push(
    `Season evaluation for a ${role.toLowerCase().replace("_", " ")}.`
  );
  if (role === "GK") {
    lines.length = 0; // override outfield template

    lines.push("Season evaluation for a goalkeeper.");

    if (subGrades.shotStopping != null) {
        lines.push(
        `Shot-stopping ability is ${band(subGrades.shotStopping)}, based on saves and expected goals faced.`
        );
    }

    if (subGrades.command != null) {
        lines.push(
        `Penalty-area command is ${band(subGrades.command)}, reflecting control on crosses and exits.`
        );
    }

    if (subGrades.distribution != null) {
        lines.push(
        `Distribution is ${band(subGrades.distribution)}, contributing to buildup from the back.`
        );
    }

    lines.push(`Overall season grade: ${overall10.toFixed(1)} / 10.`);

    return lines.join(" ");
    }


  // Category breakdown
  if (subGrades.buildup != null) {
    lines.push(
      `Buildup play is ${band(subGrades.buildup)}, with effectiveness in ball circulation and progression.`
    );
  }

  if (subGrades.contribution != null) {
    lines.push(
      `Offensive contribution is ${band(subGrades.contribution)}, showing involvement in advanced areas.`
    );
  }

  if (subGrades.defending != null) {
    lines.push(
      `Defensive performance is ${band(subGrades.defending)} compared to positional peers.`
    );
  }

  if (subGrades.discipline != null) {
    lines.push(
      `Discipline is ${band(subGrades.discipline)}, indicating control in duels and fouls.`
    );
  }

  // Overall summary
  lines.push(
    `Overall season grade: ${overall10.toFixed(1)} / 10.`
  );

  // Confidence
  if (confidence >= 0.85) {
    lines.push(
      "This evaluation is based on a high volume of minutes and is considered reliable."
    );
  } else if (confidence >= 0.5) {
    lines.push(
      "This evaluation is moderately reliable due to limited minutes."
    );
  } else {
    lines.push(
      "This evaluation is based on a small sample size and should be treated with caution."
    );
  }

  return lines.join(" ");
}
