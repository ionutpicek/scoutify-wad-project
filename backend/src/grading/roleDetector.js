// src/services/grading/roleDetector.js

const POSITION_GROUPS = {
  GK: ["GK"],

  CB: ["CB", "LCB", "RCB"],

  FULLBACK: ["RB", "LB"],

  WINGBACK: ["RWB", "LWB"],

  MIDFIELDER: [
    "DM", "DMF",
    "CM", "CMF",
    "LCM", "RCM",
    "LCMF", "RCMF",
    "AM", "AMF",
    "RAMF", "LAMF"
  ],

  WINGER: ["RW", "LW", "RWF", "LWF"],

  ATTACKER: ["CF", "ST"]
};

const normalize = p =>
  String(p).toUpperCase().replace(/[^A-Z]/g, "");

export function detectPrimaryRole(positions = [], fallback = "GENERIC") {
  if (!positions.length) {
    return { primaryRole: fallback, secondaryRole: null, roleConfidence: 0 };
  }

  const counts = {};
  Object.keys(POSITION_GROUPS).forEach(r => (counts[r] = 0));

  positions.forEach(raw => {
    normalize(raw)
      .split(",")
      .forEach(pos => {
        for (const [role, rolePositions] of Object.entries(POSITION_GROUPS)) {
          if (rolePositions.includes(pos)) {
            counts[role]++;
          }
        }
      });
  });

  // Aggregate functional groups
  const scores = {
    GK: counts.GK,
    DEFENSE: counts.CB + counts.FULLBACK + counts.WINGBACK,
    MIDFIELD: counts.MIDFIELDER,
    ATTACK: counts.WINGER + counts.ATTACKER
  };

  // Resolve primary role
  let primaryRole = fallback;

  if (scores.GK > 0 && scores.GK >= Math.max(scores.DEFENSE, scores.MIDFIELD, scores.ATTACK)) {
    primaryRole = "GK";
  } else if (scores.ATTACK >= scores.DEFENSE && scores.ATTACK >= scores.MIDFIELD) {
    primaryRole = counts.WINGER >= counts.ATTACKER ? "WINGER" : "ATTACKER";
  } else if (scores.DEFENSE >= scores.MIDFIELD) {
    if (counts.WINGBACK > counts.FULLBACK) primaryRole = "WINGBACK";
    else primaryRole = counts.CB > counts.FULLBACK ? "CB" : "FULLBACK";
  } else if (scores.MIDFIELD > 0) {
    primaryRole = "MIDFIELDER";
  }

  // Secondary role (best remaining)
  const sortedRoles = Object.entries(counts)
    .filter(([r]) => r !== primaryRole)
    .sort((a, b) => b[1] - a[1]);

  const secondaryRole = sortedRoles[0]?.[1] > 0 ? sortedRoles[0][0] : null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const roleConfidence = total > 0 ? counts[primaryRole] / total : 0;

  return {
    primaryRole,
    secondaryRole,
    roleConfidence: Math.round(roleConfidence * 100) / 100
  };
}
