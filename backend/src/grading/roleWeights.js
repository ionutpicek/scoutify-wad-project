export const AVAILABLE_DERIVED_METRICS = [
  "passes_p90",
  "passAccuracy",
  "forwardPasses_p90",
  "forwardPassAccuracy",
  "progressivePasses_p90",
  "progressivePassAccuracy",
  "longPasses_p90",
  "longPassAccuracy",
  "goals_p90",
  "xG_p90",
  "assists_p90",
  "secondAssists_p90",
  "shots_p90",
  "shotsOnTarget_p90",
  "shotAccuracy",
  "touchesBox_p90",
  "progressiveRuns_p90",
  "dribbles_p90",
  "shotAssists_p90",
  "xA_p90",
  "throughPasses_p90",
  "throughPassAccuracy",
  "finalThirdPasses_p90",
  "finalThirdPassAccuracy",
  "penaltyAreaPasses_p90",
  "penaltyAreaPassAccuracy",
  "crosses_p90",
  "crossesAccurate_p90",
  "crossAccuracy",
  "duels_p90",
  "duelWinPct",
  "defensiveDuels_p90",
  "defensiveDuelWinPct",
  "offensiveDuels_p90",
  "offensiveDuelWinPct",
  "aerialDuels_p90",
  "aerialDuelWinPct",
  "interceptions_p90",
  "recoveriesOppHalf_p90",
  "recoveries_p90",
  "lossesOwnHalf_p90",
  "losses_p90",
  "clearances_p90",
  "fouls_p90",
  "foulsSuffered_p90",
  "yellowCards_p90",
  "redCards_p90",
  "offsides_p90"
];

const DISCIPLINE_METRICS = {
  yellowCards_p90: -0.45,
  redCards_p90: -0.3,
  fouls_p90: -0.25,
  foulsSuffered_p90: 0.1,
  offsides_p90: -0.05
};

export const ROLE_WEIGHTS = {
  CB: {
    __categoryWeights: {
      defending: 0.4,
      buildup: 0.3,
      contribution: 0.2,
      discipline: 0.1
    },

    defending: {
      interceptions_p90: 0.2,
      recoveriesOppHalf_p90: 0.15,
      recoveries_p90: 0.2,
      defensiveDuels_p90: 0.1,
      defensiveDuelWinPct: 0.2,
      duels_p90: 0.05,
      duelWinPct: 0.15,
      clearances_p90: 0.05,
      lossesOwnHalf_p90: -0.2,
      losses_p90: -0.1
    },

    buildup: {
      passAccuracy: 0.3,
      passes_p90: 0.25,
      forwardPasses_p90: 0.15,
      progressivePasses_p90: 0.1,
      finalThirdPasses_p90: 0.1,
      throughPasses_p90: 0.05,
      penaltyAreaPasses_p90: 0.05,
      crosses_p90: 0.05,
      crossAccuracy: 0.05
    },

    contribution: {
      goals_p90: 0.3,
      xG_p90: 0.2,
      assists_p90: 0.2,
      xA_p90: 0.1,
      shotAssists_p90: 0.05,
      secondAssists_p90: 0.05,
      shotsOnTarget_p90: 0.05,
      shotAccuracy: 0.05
    },

    discipline: {
      ...DISCIPLINE_METRICS
    }
  },

  FULLBACK: {
    __categoryWeights: {
      defending: 0.35,
      buildup: 0.25,
      progression: 0.2,
      creativity: 0.1,
      discipline: 0.1
    },

    defending: {
      interceptions_p90: 0.25,
      defensiveDuels_p90: 0.2,
      defensiveDuelWinPct: 0.15,
      recoveriesOppHalf_p90: 0.15,
      recoveries_p90: 0.1,
      duels_p90: 0.1,
      duelWinPct: 0.1,
      lossesOwnHalf_p90: -0.2,
      losses_p90: -0.1,
      clearances_p90: 0.05
    },

    buildup: {
      passAccuracy: 0.25,
      passes_p90: 0.2,
      forwardPasses_p90: 0.15,
      throughPasses_p90: 0.15,
      progressivePasses_p90: 0.1,
      finalThirdPasses_p90: 0.05,
      crosses_p90: 0.05,
      crossAccuracy: 0.05
    },

    progression: {
      dribbles_p90: 0.2,
      progressiveRuns_p90: 0.2,
      progressivePasses_p90: 0.2,
      forwardPasses_p90: 0.15,
      throughPasses_p90: 0.1,
      crossesAccurate_p90: 0.1
    },

    creativity: {
      assists_p90: 0.25,
      xA_p90: 0.2,
      shotAssists_p90: 0.15,
      finalThirdPasses_p90: 0.15,
      crosses_p90: 0.15,
      touchesBox_p90: 0.1
    },

    discipline: {
      ...DISCIPLINE_METRICS
    }
  },

  MIDFIELDER: {
    __categoryWeights: {
      defending: 0.25,
      distribution: 0.25,
      attacking: 0.25,
      progression: 0.15,
      discipline: 0.1
    },

    defending: {
      interceptions_p90: 0.2,
      recoveriesOppHalf_p90: 0.2,
      recoveries_p90: 0.1,
      duels_p90: 0.2,
      duelWinPct: 0.15,
      defensiveDuels_p90: 0.1,
      defensiveDuelWinPct: 0.1,
      lossesOwnHalf_p90: -0.2,
      losses_p90: -0.1,
      clearances_p90: 0.05
    },

    distribution: {
      passAccuracy: 0.25,
      passes_p90: 0.2,
      forwardPasses_p90: 0.15,
      progressivePasses_p90: 0.15,
      finalThirdPasses_p90: 0.1,
      throughPasses_p90: 0.05,
      penaltyAreaPasses_p90: 0.05,
      crossAccuracy: 0.05
    },

    attacking: {
      goals_p90: 0.2,
      xG_p90: 0.2,
      assists_p90: 0.2,
      xA_p90: 0.1,
      secondAssists_p90: 0.1,
      shotsOnTarget_p90: 0.1,
      shotAssists_p90: 0.1
    },

    progression: {
      progressiveRuns_p90: 0.2,
      dribbles_p90: 0.15,
      forwardPasses_p90: 0.15,
      progressivePassAccuracy: 0.1,
      throughPasses_p90: 0.1,
      crossesAccurate_p90: 0.1
    },

    discipline: {
      ...DISCIPLINE_METRICS
    }
  },

  WINGER: {
    __categoryWeights: {
      attacking: 0.35,
      creation: 0.25,
      progression: 0.2,
      passing: 0.1,
      discipline: 0.1
    },

    attacking: {
      goals_p90: 0.25,
      xG_p90: 0.2,
      shotsOnTarget_p90: 0.15,
      shotAccuracy: 0.15,
      touchesBox_p90: 0.1,
      dribbles_p90: 0.15
    },

    creation: {
      assists_p90: 0.25,
      xA_p90: 0.2,
      shotAssists_p90: 0.15,
      secondAssists_p90: 0.1,
      finalThirdPasses_p90: 0.1,
      crosses_p90: 0.1,
      throughPasses_p90: 0.1
    },

    progression: {
      progressiveRuns_p90: 0.25,
      dribbles_p90: 0.2,
      forwardPasses_p90: 0.15,
      progressivePasses_p90: 0.15,
      throughPasses_p90: 0.1,
      crossesAccurate_p90: 0.05,
      recoveries_p90: 0.05,
      losses_p90: -0.1
    },

    passing: {
      passAccuracy: 0.2,
      crossAccuracy: 0.2,
      crosses_p90: 0.2,
      forwardPasses_p90: 0.15,
      throughPasses_p90: 0.15,
      penaltyAreaPasses_p90: 0.1
    },

    discipline: {
      ...DISCIPLINE_METRICS
    }
  },

  ATTACKER: {
    __categoryWeights: {
      scoring: 0.4,
      creativity: 0.25,
      activity: 0.2,
      discipline: 0.15
    },

    scoring: {
      goals_p90: 0.35,
      xG_p90: 0.25,
      shotsOnTarget_p90: 0.2,
      shotAccuracy: 0.15,
      touchesBox_p90: 0.05
    },

    creativity: {
      assists_p90: 0.3,
      xA_p90: 0.25,
      secondAssists_p90: 0.15,
      shotAssists_p90: 0.15,
      throughPasses_p90: 0.15
    },

    activity: {
      duels_p90: 0.2,
      duelWinPct: 0.15,
      offensiveDuels_p90: 0.15,
      offensiveDuelWinPct: 0.15,
      progressiveRuns_p90: 0.15,
      dribbles_p90: 0.1,
      recoveriesOppHalf_p90: 0.1,
      recoveries_p90: 0.1,
      losses_p90: -0.1
    },

    discipline: {
      ...DISCIPLINE_METRICS
    }
  },

  GK: {
    __categoryWeights: {
      shotStopping: 0.5,
      command: 0.25,
      distribution: 0.25
    },

    shotStopping: {
      saves_p90: 0.35,
      savePct: 0.25,
      goalsConceded_p90: -0.2,
      xCG_p90: 0.2,
      xCG_diff_p90: 0.2
    },

    command: {
      exits_p90: 0.6,
      longGKAccuracy: 0.4
    },

    distribution: {
      passAccuracy: 0.4,
      goalKicks_p90: 0.35,
      longGoalKicks_p90: 0.25
    }
  },

  GENERIC: {
    __categoryWeights: {
      presence: 0.7,
      discipline: 0.3
    },

    presence: {
      passAccuracy: 0.2,
      duels_p90: 0.15,
      duelWinPct: 0.15,
      recoveriesOppHalf_p90: 0.15,
      recoveries_p90: 0.1,
      interceptions_p90: 0.15,
      progressiveRuns_p90: 0.1,
      lossesOwnHalf_p90: -0.15,
      losses_p90: -0.1
    },

    discipline: {
      ...DISCIPLINE_METRICS
    }
  }
};
