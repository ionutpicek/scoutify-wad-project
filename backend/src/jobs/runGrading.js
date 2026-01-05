import { recomputeAllSeasonGrades } from "../grading/recomputeAllSeasonGrades.js";

export async function runSeasonGrading() {
  console.log("🔄 Recomputing season grades...");
  await recomputeAllSeasonGrades({ minMinutes: 90 });
  console.log("✅ Season grading complete");
}
