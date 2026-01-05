// src/matches/bestPerformerStats.js
export const BEST_PERFORMER_STATS = {
  GK: ["saves", "reflexSaves", "goalsConceded", "xCG"],

  CB: ["interceptions", "duelsWon", "aerialDuelsWon", "clearances"],
  FULLBACK: ["interceptions", "crosses", "assists", "recoveriesOppHalf"],
  WINGBACK: ["crosses", "assists", "progressiveRuns"],

  MIDFIELDER: ["passes", "accuratePasses", "recoveriesOppHalf", "assists"],
  WINGER: ["dribblesSuccessful", "assists", "xA", "shotsOnTarget"],
  ATTACKER: ["goals", "xG", "shotsOnTarget"],

  GENERIC: ["goals", "assists", "passes", "duelsWon"]
};
