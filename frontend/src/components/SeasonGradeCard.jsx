/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState } from "react";

export default function SeasonGradeCard({ seasonGrade, statsDocId, matchesPlayed = [] }) {
  if (!seasonGrade) return null;

  const {
    overall10,
    confidence,
    subGrades,
    explanation,
    aiVerdict,
    aiGeneratedAt,
    note,
    role,
    secondaryRole,
    roleConfidence,
    blended,
  } = seasonGrade;
console.log("AI statsDocId:", statsDocId);

  const [loadingAI, setLoadingAI] = useState(false);
  const [localAIVerdict, setLocalAIVerdict] = useState(aiVerdict || null);
  const [viewMode, setViewMode] = useState(aiVerdict ? "ai" : "analyst");

  /* ---------------- AI VERDICT ---------------- */

  const generateVerdict = async () => {
    try {
      setLoadingAI(true);

      const res = await fetch(
        `http://localhost:3001/ai/scout-verdict/${statsDocId}`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      setLocalAIVerdict(data.aiVerdict);
      setViewMode("ai");
    } catch {
      alert("Failed to generate AI scout verdict.");
    } finally {
      setLoadingAI(false);
    }
  };

  /* ---------------- NOT ENOUGH DATA ---------------- */

  if (overall10 == null) {
    return (
      <div style={cardStyle}>
        <h2 style={titleStyle}>Season Grade</h2>
        <p style={{ color: "#999" }}>
          {note || "Not enough data to generate a season grade."}
        </p>
      </div>
    );
  }

  /* ---------------- NORMAL CASE ---------------- */

  const showAI = viewMode === "ai" && localAIVerdict;

  return (
    <div style={cardStyle}>
      <div style={mainGrid}>
        {/* LEFT COLUMN */}
        <div style={leftColumn}>
          <div style={gradeRow}>
            <span style={gradeValue}>{overall10.toFixed(1)}</span>
            <span style={gradeOutOf}>/ 10</span>
          </div>

          <p style={confidenceStyle}>
            Confidence: {(confidence * 100).toFixed(0)}%
          </p>

          <div style={subGradesWrap}>
            {Object.entries(subGrades || {}).map(([key, value]) => (
              <div key={key} style={subGradeItem}>
                <div style={subGradeHeader}>
                  <span style={subGradeLabel}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                  <span style={subGradeValue}>{value}</span>
                </div>
                <div style={barBackground}>
                  <div
                    style={{
                      ...barFill,
                      width: `${value}%`,
                      backgroundColor: gradeColor(value),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={roleBlock}>
            <p style={{ margin: 0, color: "#666" }}>
              Role: <strong>{role}</strong>
              {secondaryRole && <> / <strong>{secondaryRole}</strong></>}
            </p>

            <p style={roleConfidenceStyle}>
              Role confidence: {Math.round(roleConfidence * 100)}%
            </p>

            {blended && (
              <p style={hybridNote}>Hybrid role evaluation</p>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN */}
        <div style={midColumn}>
          <div style={verdictHeader}>
            <h3 style={verdictTitle}>Scout Verdict</h3>

            {localAIVerdict && (
              <div style={aiBadge}>
                🤖 AI Generated
                {aiGeneratedAt && (
                  <span style={aiTime}>
                    · {new Date(aiGeneratedAt.seconds * 1000).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div style={actionRow}>
            {!localAIVerdict && (
              <button
                onClick={generateVerdict}
                disabled={loadingAI}
                style={aiButton}
              >
                {loadingAI ? "Generating..." : "Generate AI Verdict"}
              </button>
            )}

            {localAIVerdict && (
              <>
                <button
                  onClick={() =>
                    setViewMode(viewMode === "ai" ? "analyst" : "ai")
                  }
                  style={toggleButton}
                >
                  {showAI ? "Show Analyst Review" : "Show AI Verdict"}
                </button>

                <button
                  onClick={generateVerdict}
                  disabled={loadingAI}
                  style={secondaryButton}
                >
                  Regenerate AI
                </button>
              </>
            )}
          </div>

          {/* VERDICT TEXT */}
          <p style={explanationText}>
            {showAI
              ? localAIVerdict
              : explanation || "No analyst explanation available."}
          </p>

          {confidence < 0.6 && (
            <p style={confidenceWarning}>
              ⚠ Based on limited minutes – interpret with caution.
            </p>
          )}
        </div>

        {/* RIGHT COLUMN (MATCHES) */}
        <div style={matchesColumn}>
          <h3 style={verdictTitle}>Matches played</h3>
          {matchesPlayed && matchesPlayed.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {matchesPlayed.map(m => (
                <div key={m.id} style={matchRow}>
                  <div style={{ flex: 1, fontWeight: 700, color: "#222", minWidth: 140 }}>
                    {m.gameName}
                  </div>
                  <div style={{ width: 70, textAlign: "center", color: "#555", fontSize: 13 }}>
                    {m.date || ""}
                  </div>
                  <div style={{ width: 50, textAlign: "center", color: "#555", fontSize: 13 }}>
                    {m.minutes || 0}'
                  </div>
                  <div style={{ width: 60, textAlign: "center", color: "#555", fontSize: 13 }}>
                    {m.position || "-"}
                  </div>
                  <div style={{ width: 50, textAlign: "center", fontWeight: 700, color: "#111" }}>
                    {m.grade != null ? Number(m.grade).toFixed(1) : "-"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#777", fontSize: 13, margin: 0 }}>No matches recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STYLES (UNCHANGED + NEW) ---------------- */

const verdictHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};

const actionRow = {
  display: "flex",
  gap: 10,
  marginBottom: 12,
};

const aiBadge = {
  fontSize: 12,
  color: "#FF681F",
  fontWeight: 600,
};

const aiTime = {
  marginLeft: 6,
  color: "#999",
  fontWeight: 400,
};

const toggleButton = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  color:"#000"
};

const secondaryButton = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #FF681F",
  background: "#fff",
  color: "#FF681F",
  cursor: "pointer",
};

/* ---------------- STYLES ---------------- */

const cardStyle = {
  background: "#fff",
  border: "2px solid #FF681F",
  borderRadius: 18,
  padding: "24px 28px",
  width: "85vw",
  height: "65vh",
  margin: "3vh auto",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
};

const titleStyle = {
  color: "#FF681F",
  fontSize: "1.8rem",
  fontWeight: 600,
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "260px 1fr 1fr",
  gap: 24,
  alignItems: "stretch",
  height: "100%",          
};


const leftColumn = { display: "flex", flexDirection: "column" };

const gradeRow = { display: "flex", alignItems: "baseline", gap: 8 };

const gradeValue = {
  fontSize: 60,
  fontWeight: 800,
  color: "#FF681F",
};

const gradeOutOf = { fontSize: 22, color: "#555" };

const confidenceStyle = { fontSize: 14, color: "#666", marginBottom: 12 };

const subGradesWrap = { marginTop: 4 };

const subGradeItem = { marginBottom: 10 };

const subGradeHeader = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 14,
  marginBottom: 4,
};

const subGradeLabel = { color: "#444" };
const subGradeValue = { fontWeight: 700 };

const barBackground = {
  width: "100%",
  height: 8,
  backgroundColor: "#eee",
  borderRadius: 6,
};

const barFill = { height: "100%", borderRadius: 6 };

const midColumn = {
  backgroundColor: "#fafafa",
  borderRadius: 14,
  padding: "22px 24px",
  border: "1px solid #eee",
  overflowY: "auto",
};

const matchesColumn = {
  backgroundColor: "#fafafa",
  borderRadius: 14,
  padding: "22px 24px",
  border: "1px solid #eee",
  minWidth: 240,
  height: "90%",
  overflowY: "auto",
};

const verdictTitle = {
  marginBottom: 12,
  fontSize: "1.4rem",
  fontWeight: 700,
  color: "#FF681F",
};

const explanationText = {
  fontSize: "1.05rem",
  lineHeight: 1.75,
  color: "#333",
};

const aiButton = {
  marginBottom: 12,
  padding: "8px 14px",
  background: "#FF681F",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const roleBlock = { marginTop: 10 };

const roleConfidenceStyle = { fontSize: 13, color: "#666", margin: "4px 0" };

const hybridNote = { fontSize: 12, color: "#888" };

const confidenceWarning = {
  marginTop: 16,
  fontSize: 13,
  color: "#999",
  fontStyle: "italic",
};

const gradeColor = (v) => {
  if (v >= 70) return "#2ecc71";
  if (v >= 50) return "#f1c40f";
  return "#e74c3c";
};

const matchRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #f1f1f1",
};
