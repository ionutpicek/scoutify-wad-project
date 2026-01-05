// src/services/grading/gameBenchmarks.js

export const GAME_BENCHMARKS = {
  ATTACKER: {
    goals:         [0, 0.7, 1.5, 2.2],
    xG:            [0.2, 0.6, 1.2, 1.8],
    shotsOnTarget: [1, 3, 5, 7],
    assists:       [0, 0.5, 1.2, 2.0],
    xA:            [0.05, 0.25, 0.6, 1.0]
  },

  WINGER: {
    assists:         [0, 0.6, 1.5, 2.2],
    xA:              [0.08, 0.3, 0.7, 1.1],
    shotAssists:     [1, 2, 4, 6],
    progressiveRuns: [2, 5, 9, 13],
    crossesAccurate: [1, 3, 6, 9],
    duelWinPct:      [45, 55, 65, 75]
  },

  MIDFIELDER: {
    passAccuracy:     [78, 85, 90, 93],
    recoveries:       [4, 8, 13, 17],
    interceptions:    [1, 3, 6, 9],
    shotAssists:      [0.5, 1.5, 3, 5],
    assists:          [0, 0.5, 1.2, 2],
    losses:           [6, 4, 2, 1] // inverted via map
  },

  CB: {
    duelWinPct:      [55, 70, 85, 92],
    interceptions:   [1.5, 4, 8, 11],
    clearances:      [3, 6, 10, 14],
    losses:          [5, 3, 1, 0], // inverted
    aerialDuelWinPct:[50, 65, 80, 88]
  },

  FULLBACK: {
    interceptions:     [1, 3, 6, 9],
    crossesAccurate:   [1, 3, 6, 9],
    progressiveRuns:   [2, 5, 9, 13],
    duelWinPct:        [45, 55, 65, 75],
    shotAssists:       [0.5, 1.5, 3, 5]
  },

  GK: {
    saves:         [2, 5, 8, 11],
    xCG_diff:      [-0.3, 0.0, 0.6, 1.0],
    goalsConceded: [3, 1, 0.5, 0], // inverted
    savePct:       [55, 70, 82, 90]
  }
};
