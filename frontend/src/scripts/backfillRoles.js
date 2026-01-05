// src/scripts/backfillRolesAndDerived.js
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";
import { computeDerivedMetrics } from "../../../backend/src/grading/derivedMetrics";
import { detectPrimaryRole } from "../../../backend/src/grading/roleDetector";

export async function backfillRolesAndDerived() {
  const snap = await getDocs(collection(db, "stats"));
  const batch = writeBatch(db);

  snap.forEach(d => {
    const data = d.data();
    const derived = computeDerivedMetrics(data);
    const primaryRole = detectPrimaryRole(data.positions || []);

    batch.update(doc(db, "stats", d.id), {
      derived,
      primaryRole
    });
  });

  await batch.commit();
  console.log("✅ Backfill complete");
}