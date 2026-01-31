/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useMemo } from "react";
import { apiUrl } from "../config/api.js";

const SCOUT_HEADINGS = [
  "Offensive",
  "Passing profile",
  "Dribbling",
  "Defensive",
  "Strengths",
  "Development",
  "Conclusion",
];

const SCOUT_ICONS = {
  Offensive: "⚽️",
  "Passing profile": "🎯",
  Dribbling: "⚡",
  Defensive: "🛡️",
  Strengths: "🧠",
  Development: "🚀",
  Conclusion: "⭐",
  GPS: "📡",
};

const findNextHeadingIndex = (text, startIndex, headingOrder) => {
  let nextIndex = -1;
  for (const heading of headingOrder) {
    const idx = text.indexOf(heading, startIndex);
    if (idx !== -1 && (nextIndex === -1 || idx < nextIndex)) {
      nextIndex = idx;
    }
  }
  return nextIndex;
};

const sanitizeSnapshotText = (value = "") =>
  value
    .replace(/\*\*/g, "")
    .replace(/#+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseSnapshotSections = (text = "") => {
  if (!text) return { cards: {}, summary: "", roleTitle: "" };
  try {
    const payload = JSON.parse(text);
    const cards = {};
    if (Array.isArray(payload.cards)) {
      payload.cards.forEach((card) => {
        if (card?.heading) {
          cards[card.heading] = {
            narrative: sanitizeSnapshotText(card.narrative || ""),
            number: sanitizeSnapshotText(card.number || ""),
            what: sanitizeSnapshotText(card.what_it_looks_like || ""),
            cue: sanitizeSnapshotText(card.coaching_cue || ""),
          };
        }
      });
    }
    return {
      cards,
      summary: sanitizeSnapshotText(payload.summary_text || ""),
      roleTitle: sanitizeSnapshotText(payload.role_title || ""),
    };
  } catch {
    const normalized = text.replace(/\r/g, "");
    const sections = {};
    SCOUT_HEADINGS.forEach((heading, index) => {
      const start = normalized.indexOf(heading);
      if (start === -1) {
        sections[heading] = "";
        return;
      }
      const remainingHeadings = SCOUT_HEADINGS.slice(index + 1);
      const nextIndex = findNextHeadingIndex(
        normalized,
        start + heading.length,
        remainingHeadings
      );
      const slice =
        nextIndex === -1
          ? normalized.slice(start + heading.length)
          : normalized.slice(start + heading.length, nextIndex);
      sections[heading] = sanitizeSnapshotText(slice);
    });
    return { cards: sections, summary: "", roleTitle: "" };
  }
};

const extractRoleTitle = (text = "") => {
  if (!text) return "";
  const match = text.match(/Role title:\s*(.+)/i);
  if (match) return match[1].trim();
  const firstLine = text.split(/\r?\n/)[0];
  return (firstLine || "").trim();
};

export default function SeasonGradeCard({
  seasonGrade,
  statsDocId,
  matchesPlayed = [],
  scoutSnapshot,
  onRegenerateSnapshot,
  isAdmin,
  generatingSnapshot = false,
  physicalMetrics = null,
}) {
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
  const [verdictMode, setVerdictMode] = useState(aiVerdict ? "ai" : "analyst");
  const [rightMode, setRightMode] = useState("matches");
  const snapshotData = useMemo(
    () => parseSnapshotSections(scoutSnapshot || localAIVerdict || ""),
    [scoutSnapshot, localAIVerdict]
  );
  const snapshotRoleTitle =
    snapshotData.roleTitle || extractRoleTitle(scoutSnapshot || localAIVerdict || "");

  const gpsNarrative = useMemo(() => {
    if (!physicalMetrics) return "";
    const fragments = [];
    if (physicalMetrics.kmPer90 != null) {
      fragments.push(`${physicalMetrics.kmPer90.toFixed(2)} km/90`);
    }
    if (physicalMetrics.topSpeedKmh != null) {
      fragments.push(`${physicalMetrics.topSpeedKmh.toFixed(1)} km/h top speed`);
    }
    if (physicalMetrics.avgBpm != null) {
      fragments.push(`${physicalMetrics.avgBpm.toFixed(0)} bpm avg`);
    }
    if (physicalMetrics.avgSprints != null) {
      fragments.push(`${physicalMetrics.avgSprints.toFixed(0)} sprints`);
    }
    return fragments.join("; ");
  }, [physicalMetrics]);

  const displayCards = useMemo(() => {
    const cardsMap = { ...snapshotData.cards };
    const baseline = SCOUT_HEADINGS;
    const beforeStrengths = baseline.slice(0, 4);
    const afterStrengths = baseline.slice(4);

    if (gpsNarrative) {
      cardsMap.GPS = { narrative: gpsNarrative };
      return [...beforeStrengths, "GPS", ...afterStrengths];
    }
    return baseline;
  }, [snapshotData, gpsNarrative]);

  const generateVerdict = async () => {
    try {
      setLoadingAI(true);

      const res = await fetch(apiUrl(`/ai/scout-verdict/${statsDocId}`), {
        method: "POST",
      });

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      setLocalAIVerdict(data.aiVerdict);
      setVerdictMode("ai");
    } catch {
      alert("Failed to generate AI scout verdict.");
    } finally {
      setLoadingAI(false);
    }
  };

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

  const showAI = verdictMode === "ai" && localAIVerdict;
  const verdictSummary =
    snapshotData.summary ||
    (showAI
      ? localAIVerdict
      : explanation || "No analyst explanation available.");

  return (
    <div style={cardStyle}>
      <div style={mainGrid}>
        <div style={leftColumn}>
          <div style={gradeRow}>
            <span style={gradeValue}>{overall10.toFixed(1)}</span>
            <span style={gradeOutOf}>/ 10</span>
          </div>

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

            {blended && <p style={hybridNote}>Hybrid role evaluation</p>}
          </div>

          <div style={leftControls}>
            <div style={modeToggle}>
              <button
                type="button"
                onClick={() => setRightMode("matches")}
                style={{
                  ...modeButton,
                  ...(rightMode === "matches" ? activeModeButton : {}),
                }}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setRightMode("scout")}
                style={{
                  ...modeButton,
                  ...(rightMode === "scout" ? activeModeButton : {}),
                }}
              >
                Insights
              </button>
            </div>
            {isAdmin && onRegenerateSnapshot && (
              <button
                type="button"
                onClick={onRegenerateSnapshot}
                disabled={generatingSnapshot}
                style={regenerateSnapshotButton}
              >
                {generatingSnapshot ? "Regenerating..." : "Regenerate Insights"}
              </button>
            )}
          </div>
        </div>

        <div style={rightColumn}>
          {rightMode === "matches" ? (
            <div style={matchesViewGrid}>
              <div style={verdictPanel}>
                <div style={verdictHeader}>
                  <h3 style={verdictTitle}>Scout Verdict</h3>
                  {localAIVerdict && (
                    <div style={aiBadge}>
                      🤖 AI Generated
                      {aiGeneratedAt && (
                        <span style={aiTime}>
                          ·{" "}
                          {new Date(
                            aiGeneratedAt.seconds * 1000
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isAdmin && (
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
                            setVerdictMode(verdictMode === "ai" ? "analyst" : "ai")
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
                )}

                <p style={explanationText}>{verdictSummary}</p>

                {confidence < 0.6 && (
                  <p style={confidenceWarning}>
                    ⚠️ Based on limited minutes – interpret with caution.
                  </p>
                )}
              </div>

              <div style={matchesPanel}>
                <h3 style={verdictTitle}>Matches played</h3>
                {matchesPlayed && matchesPlayed.length > 0 ? (
                  <div style={matchesList}>
                    {matchesPlayed.map((m) => (
                      <div key={m.id} style={matchRow}>
                        <div
                          style={{
                            flex: 1,
                            fontWeight: 700,
                            color: "#222",
                            minWidth: 120,
                          }}
                        >
                          {m.gameName}
                        </div>
                        <div
                          style={{
                            width: "18%",
                            textAlign: "center",
                            color: "#555",
                            fontSize: 13,
                          }}
                        >
                          {m.date || ""}
                        </div>
                        <div
                          style={{
                            width: "14%",
                            textAlign: "center",
                            color: "#555",
                            fontSize: 13,
                          }}
                        >
                          {m.minutes || 0}'
                        </div>
                        <div
                          style={{
                            width: "16%",
                            textAlign: "center",
                            color: "#555",
                            fontSize: 13,
                          }}
                        >
                          {m.position || "-"}
                        </div>
                        <div
                          style={{
                            width: "15%",
                            textAlign: "center",
                            fontWeight: 700,
                            color: "#111",
                          }}
                        >
                          {m.grade != null ? Number(m.grade).toFixed(1) : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#777", fontSize: 13, margin: 0 }}>
                    No matches recorded.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={scoutSnapshotWrapper}>
            {snapshotRoleTitle && (
              <p style={scoutRoleTitle}>{snapshotRoleTitle}</p>
            )}
              <div style={scoutGrid}>
                {(() => {
                  const cardsMap = { ...snapshotData.cards };
                  if (gpsNarrative) cardsMap.GPS = { narrative: gpsNarrative };
                  return displayCards.map((heading) => {
                    const card = cardsMap[heading];
                    const text = card?.narrative || "";
                    return (
                      <div key={heading} style={{ ...scoutCard }}>
                        <div style={scoutCardHeader}>
                          <span style={scoutIcon}>{SCOUT_ICONS[heading] || ""}</span>
                          <span>{heading}</span>
                        </div>
                        <div style={scoutCardBody}>
                          <p style={scoutParagraph}>{text || "—"}</p>
                          {card?.number && <p style={scoutNumber}>{card.number}</p>}
                          {card?.what && <p style={scoutWhat}>{card.what}</p>}
                          {card?.cue && <p style={scoutCue}>{card.cue}</p>}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  color: "#000",
};

const secondaryButton = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #FF681F",
  background: "#fff",
  color: "#FF681F",
  cursor: "pointer",
};

const cardStyle = {
  background: "#fff",
  border: "2px solid #FF681F",
  borderRadius: 18,
  padding: "24px 28px",
  width: "85vw",
  height: "78vh",
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
  gridTemplateColumns: "260px minmax(0, 1fr)",
  gap: 24,
  alignItems: "stretch",
  height: "100%",
};

const leftColumn = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  gap: 20,
  minHeight: 0,
};

const leftControls = {
  marginTop: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const gradeRow = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};

const gradeValue = {
  fontSize: 60,
  fontWeight: 800,
  color: "#FF681F",
};

const gradeOutOf = {
  fontSize: 22,
  color: "#555",
};

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

const roleBlock = { marginTop: 10 };

const roleConfidenceStyle = {
  fontSize: 13,
  color: "#666",
  margin: "4px 0",
};

const hybridNote = { fontSize: 12, color: "#888" };

const gradeColor = (v) => {
  if (v >= 70) return "#2ecc71";
  if (v >= 50) return "#f1c40f";
  return "#e74c3c";
};

const modeToggle = {
  display: "flex",
  gap: 10,
};

const modeButton = {
  flex: 1,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#fff",
  padding: "10px 12px",
  fontWeight: 600,
  color: "#000",
  cursor: "pointer",
  marginTop:"-1vh"
};

const activeModeButton = {
  background: "#FF681F",
  color: "#fff",
  borderColor: "#FF681F",
};

const rightColumn = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
};

const matchesViewGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  height: "90%",
};

const verdictPanel = {
  backgroundColor: "#fafafa",
  borderRadius: 14,
  padding: "20px",
  border: "1px solid #eee",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  overflowY: "auto",
  maxHeight: "100%",
};

const matchesPanel = {
  backgroundColor: "#fafafa",
  borderRadius: 14,
  padding: "20px",
  border: "1px solid #eee",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  overflowY: "auto",
  maxHeight: "100%",
};

const matchesList = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  overflowY: "auto",
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

const scoutSnapshotWrapper = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  height: "100%",
  overflowY: "auto",
  maxHeight: "100%",
};

const scoutRoleTitle = {
  margin: 0,
  fontWeight: 600,
  fontSize: "1.1rem",
  color: "#333",
};

const scoutGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gridAutoRows: "minmax(0, 1fr)",
  gap: 14,
  flex: 1,
  minHeight: 0,
};

const scoutCard = {
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "#fff",
  padding: "8px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minHeight: 0,
  overflowY: "auto",
  alignSelf: "stretch",
};

const scoutCardHeader = {
  fontSize: 16,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const scoutIcon = {
  fontSize: 18,
};

const scoutCardBody = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  maxHeight: "80%",
  wordBreak: "break-word",
};

const scoutParagraph = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};

const scoutNumber = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "#555",
};

const scoutWhat = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "#444",
};

const scoutCue = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "#111",
  fontStyle: "italic",
};

const regenerateSnapshotButton = {
  alignSelf: "flex-end",
  padding: "8px 16px",
  borderRadius: 12,
  border: "none",
  background: "#111",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "center",
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

const confidenceWarning = {
  marginTop: 16,
  fontSize: 13,
  color: "#999",
  fontStyle: "italic",
};
