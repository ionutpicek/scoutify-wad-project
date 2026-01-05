import React, { useState } from "react";
import { recomputeSeasonGrades } from "../services/gradingApi";

export default function AdminGrades() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const run = async () => {
    setLoading(true);
    setDone(false);
    try {
      await recomputeSeasonGrades({ minMinutes: 90 });
      setDone(true);
      alert("Season grades recomputed successfully!");
    } catch (err) {
      console.error(err);
      alert("Error recomputing grades");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Admin – Season Grading</h2>
      <button onClick={run} disabled={loading}>
        {loading ? "Computing…" : "Recompute Season Grades"}
      </button>
      {done && <p>✅ Done</p>}
    </div>
  );
}