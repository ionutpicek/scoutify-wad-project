import React, { useState } from "react";
import { recomputeSeasonGrades } from "../../services/gradingApi";
import "./AdminGradesMobile.css";
import { useNavigate } from "react-router-dom";

export default function AdminGradesMobile() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const run = async () => {
    setLoading(true);
    setDone(false);
    try {
      await recomputeSeasonGrades({ minMinutes: 90 });
      setDone(true);
    } catch (err) {
      console.error("Season grade API failed:", err);
      alert("Error recomputing grades.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-grades-shell">
      <header className="admin-grades-header">
        <div>
          <p className="admin-grades-title">Season grades</p>
          <p className="admin-grades-subtitle">Recompute grades for the entire league.</p>
        </div>
        <button type="button" className="admin-grades-back" onClick={() => navigate("/dashboard")}>
          Back
        </button>
      </header>

      <div className="admin-grades-card">
        <p className="admin-grades-card-title">Compute cycle</p>
        <p className="admin-grades-card-desc">
          Recalculate season grades across all players. This kicks off the backend scoring job.
        </p>
        <button
          type="button"
          className="admin-grades-submit"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Computing…" : "Recompute Season Grades"}
        </button>
        {done && <span className="admin-grades-done">✔ Last run finished</span>}
      </div>
    </div>
  );
}
