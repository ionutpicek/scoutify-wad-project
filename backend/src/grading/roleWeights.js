export const ROLE_WEIGHTS = {
  CB: {
    __categoryWeights: {
      defending: 0.55,
      buildup: 0.30,
      contribution: 0.15,
    },

    defending: {
      interceptions_p90: 0.35,
      duelWinPct: 0.35,
      recoveriesOppHalf_p90: 0.30,
    },

    buildup: {
      passAccuracy: 0.45,
      passes_p90: 0.30,
      lossesOwnHalf_p90: -0.25,
    },

    contribution: {
      assists_p90: 0.60,
      shotsOnTarget_p90: 0.40,
    },
  },

  FULLBACK: {
    __categoryWeights: {
      defending: 0.40,
      buildup: 0.35,
      contribution: 0.25,
    },

    defending: {
      interceptions_p90: 0.25,
      defensiveDuels_p90: 0.25,
      defensiveDuelWinPct: 0.25,
      recoveriesOppHalf_p90: 0.25,
    },

    buildup: {
      passAccuracy: 0.45,
      passes_p90: 0.25,
      lossesOwnHalf_p90: -0.30,
    },

    contribution: {
      assists_p90: 0.35,
      finalThirdPasses_p90: 0.35,
      touchesBox_p90: 0.30,
    },
  },

  MIDFIELDER: {
    __categoryWeights: {
      defending: 0.30,
      buildup: 0.40,
      contribution: 0.30,
    },

    defending: {
      interceptions_p90: 0.30,
      recoveriesOppHalf_p90: 0.40,
      duelWinPct: 0.30,
    },

    buildup: {
      passAccuracy: 0.45,
      passes_p90: 0.35,
      lossesOwnHalf_p90: -0.20,
    },

    contribution: {
      assists_p90: 0.45,
      shotsOnTarget_p90: 0.25,
      xG_p90: 0.30,
    },
  },

  WINGER: {
    __categoryWeights: {
      attacking: 0.45,
      creativity: 0.30,
      progression: 0.15,
      passing: 0.10,
    },

    attacking: {
      goals_p90: 0.30,
      xG_p90: 0.25,
      shotsOnTarget_p90: 0.25,
    },

    creativity: {
      assists_p90: 0.35,
      xA_p90: 0.30,
      shotAssists_p90: 0.20,
    },

    progression: {
      dribbles_p90: 0.35,
      progressiveRuns_p90: 0.40,
      touchesBox_p90: 0.25,
    },

    passing: {
      passAccuracy: 0.20,
      finalThirdPasses_p90: 0.30,
      crosses_p90: 0.30,
    },
  },

  ATTACKER: {
    __categoryWeights: {
      scoring: 0.50,
      creativity: 0.30,
      activity: 0.20,
    },

    scoring: {
      goals_p90: 0.40,
      xG_p90: 0.35,
      shotsOnTarget_p90: 0.25,
    },

    creativity: {
      assists_p90: 0.55,
      passAccuracy: 0.20,
      passes_p90: 0.25,
    },

    activity: {
      shots_p90: 0.60,
      recoveriesOppHalf_p90: 0.40,
    },
  },

  GK: {
    __categoryWeights: {
      shotStopping: 0.55,
      command: 0.25,
      distribution: 0.20,
    },

    shotStopping: {
      savePct: 0.45,
      xCG_diff_p90: 0.35,
      goalsConceded_p90: -0.20,
    },

    command: {
      exits_p90: 0.6,
      saves_p90: 0.4,
    },

    distribution: {
      passAccuracy: 0.4,
      longPassAccuracy: 0.3,
      longGKAccuracy: 0.3,
    },
  },

  GENERIC: {
    __categoryWeights: {
      allround: 1.0,
    },

    allround: {
      passAccuracy: 0.30,
      duelWinPct: 0.25,
      interceptions_p90: 0.20,
      recoveriesOppHalf_p90: 0.15,
      lossesOwnHalf_p90: -0.10,
    },
  },
};
