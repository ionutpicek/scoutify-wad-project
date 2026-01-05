// src/grading/recomputeAllSeasonGrades.js

import { db } from "../firebase/firebaseAdmin.js";

import { gradeSeason } from "./seasonGrading.js";
import { generateSeasonExplanation } from "./gradeExplanation.js";
import { detectPrimaryRole } from "./roleDetector.js";
import { attachAIScoutVerdict } from "../jobs/generateScoutVerdict.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const GRADING_VERSION = 1;

export async function recomputeAllSeasonGrades({ minMinutes = 90 } = {}) {

  const normalizeRoleProfile = (s) => {
    if (s.roleProfile && typeof s.roleProfile === "object" && s.roleProfile.primaryRole) {
      return s.roleProfile;
    }
    if (s.primaryRole && typeof s.primaryRole === "object" && s.primaryRole.primaryRole) {
      return s.primaryRole;
    }
    if (typeof s.primaryRole === "string") {
      return {
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole ?? null,
        roleConfidence: s.roleConfidence ?? 1
      };
    }
    return detectPrimaryRole(s.positions || [], "GENERIC");
  };

  /* --------------------------------------------------
   * LOAD STATS (ADMIN SDK)
   * -------------------------------------------------- */
  const snap = await db.collection("stats").get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  /* --------------------------------------------------
   * GROUP PEERS BY ROLE
   * -------------------------------------------------- */
  const byRole = new Map();

  for (const s of all) {
    const minutes = Number(s.minutes) || 0;
    if (minutes < minMinutes) continue;

    const roleProfile = normalizeRoleProfile(s);
    const role = roleProfile.primaryRole || "GENERIC";

    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(s);
  }

  /* --------------------------------------------------
   * PHASE 1 — COMPUTE & STORE GRADES
   * -------------------------------------------------- */
  const batch = db.batch();
  const gradedPlayers = [];

  for (const s of all) {
    const minutes = Number(s.minutes) || 0;
    if (minutes < minMinutes) continue;
    if (!s.derived) continue;

    const roleProfile = normalizeRoleProfile(s);

    const { primaryRole, secondaryRole, roleConfidence = 1 } = roleProfile;

    const peers = byRole.get(primaryRole) || [];
    const peerDerivedList = peers.map(p => p.derived).filter(Boolean);

    const statRef = db.collection("stats").doc(s.id);

    /* Not enough peers */
    if (peerDerivedList.length < 2) {
      batch.update(statRef, {
        roleProfile,
        primaryRole,
        seasonGrade: {
          version: GRADING_VERSION,
          role: primaryRole,
          overall10: null,
          overall100: null,
          confidence: clamp01(minutes / 900),
          note: "Not enough comparable players"
        }
      });
      continue;
    }

    /* Primary grade */
    const gradePrimary = gradeSeason({
      role: primaryRole,
      totals: s,
      peerDerivedList
    });

    let finalGrade = {
      ...gradePrimary,
      role: primaryRole,
      secondaryRole: null,
      roleConfidence
    };

    /* Secondary role blending */
    if (secondaryRole && roleConfidence < 0.7) {
      const secondaryPeers = byRole.get(secondaryRole) || [];
      const secondaryDerived = secondaryPeers.map(p => p.derived).filter(Boolean);

      if (secondaryDerived.length >= 2) {
        const gradeSecondary = gradeSeason({
          role: secondaryRole,
          totals: s,
          peerDerivedList: secondaryDerived
        });

        finalGrade = {
          ...finalGrade,
          secondaryRole,
          blended: true,
          overall100: Math.round(
            gradePrimary.overall100 * roleConfidence +
            gradeSecondary.overall100 * (1 - roleConfidence)
          ),
          overall10: Math.round(
            (
              gradePrimary.overall10 * roleConfidence +
              gradeSecondary.overall10 * (1 - roleConfidence)
            ) * 10
          ) / 10
        };
      }
    }

    finalGrade.explanation = generateSeasonExplanation(finalGrade);
    finalGrade.confidence = clamp01(minutes / 900);
    finalGrade.version = GRADING_VERSION;

    batch.update(statRef, {
      roleProfile,
      primaryRole,
      seasonGrade: finalGrade
    });

    gradedPlayers.push({ statRef, finalGrade });
  }

  await batch.commit();
}
