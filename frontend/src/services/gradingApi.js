const API_BASE = "http://localhost:3001";

export async function recomputeSeasonGrades() {
  const res = await fetch(`${API_BASE}/grading/recompute`, {
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
