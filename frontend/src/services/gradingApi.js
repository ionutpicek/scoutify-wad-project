import { apiUrl } from "../config/api.js";

export async function recomputeSeasonGrades() {
  const res = await fetch(apiUrl("/grading/recompute"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to recompute grades");
  }

  return res.json();
}
