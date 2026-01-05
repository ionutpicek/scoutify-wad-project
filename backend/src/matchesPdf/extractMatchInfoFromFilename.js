// src/matches/extractMatchInfoFromFilename.js

function fixMojibake(str) {
  return String(str || "")
    .replace(/\u00c5\u00a3/g, "t")
    .replace(/\u00c5\u015f/g, "s")
    .replace(/\u00c5\u009f/g, "s")
    .replace(/\u00c4\u0083/g, "a")
    .replace(/\u00c3\u00a2/g, "a")
    .replace(/\u00c3\u00ae/g, "i")
    .replace(/\u00c4\u0082/g, "a")
    .replace(/\u00c5\u017d/g, "s")
    .replace(/\u00c5/g, "s");
}

export function extractMatchInfoFromFilename(filename) {
  // Remove extension
  const name = filename.replace(/\.pdf$/i, "").trim();

  /**
   * Expected format:
   * Team A - Team B 3-1
   */
  const match = name.match(
    /(.+?)\s*-\s*(.+?)\s+(\d+)\s*-\s*(\d+)$/u
  );

  if (!match) {
    throw new Error(
      `Invalid match filename format: "${filename}"`
    );
  }

  const [, homeTeam, awayTeam, homeGoals, awayGoals] = match;

  return {
    homeTeam: fixMojibake(homeTeam).trim(),
    awayTeam: fixMojibake(awayTeam).trim(),
    score: `${homeGoals}-${awayGoals}`,
    homeGoals: Number(homeGoals),
    awayGoals: Number(awayGoals)
  };
}
