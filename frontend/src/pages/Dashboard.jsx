import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/Header";

const ORANGE = "#FF681F";
const ORANGE_SOFT = "#FFF2E8";
const BG = "#FAFAFA";
const TEXT = "#111827";
const MUTED = "#6B7280";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // safer on refresh
  const { role: userRole, username, userTeam } = location.state || {};

  const [hovered, setHovered] = useState(null);

  const handleLogout = () => navigate("/login");

  const styles = useMemo(
    () => ({
      page: {
        minHeight: "100vh",
        width: "100vw",
        background: BG,
      },

      content: {
        maxWidth: 1200,
        margin: "0 auto",
        padding: "28px 20px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      },

      topHint: {
        background: "white",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 16,
        boxShadow: "0 10px 20px rgba(0,0,0,0.06)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      },

      hintLeft: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: TEXT,
        fontWeight: 800,
      },

      hintSub: {
        marginLeft: 34,
        marginTop: 2,
        fontSize: 13,
        color: MUTED,
        fontWeight: 600,
      },

      hintPill: {
        background: ORANGE_SOFT,
        color: ORANGE,
        border: `1px solid rgba(255,104,31,0.25)`,
        padding: "8px 12px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 900,
        whiteSpace: "nowrap",
      },

      sectionRow: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 6,
      },

      sectionTitle: {
        fontSize: 16,
        fontWeight: 900,
        color: TEXT,
        letterSpacing: 0.2,
      },

      sectionHint: {
        fontSize: 13,
        color: MUTED,
        fontWeight: 600,
      },

      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 18,
      },

      card: {
        position: "relative",
        background: "white",
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.07)",
        padding: 18,
        cursor: "pointer",
        transition: "transform 140ms ease, box-shadow 140ms ease",
        overflow: "hidden",
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      },

      accent: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 8,
        background: ORANGE,
      },

      cardTop: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      },

      titleWrap: {
        display: "flex",
        alignItems: "center",
        gap: 10,
      },

      iconBubble: {
        width: 42,
        height: 42,
        borderRadius: 14,
        background: ORANGE_SOFT,
        border: `1px solid rgba(255,104,31,0.25)`,
        display: "grid",
        placeItems: "center",
        fontSize: 18,
      },

      cardTitle: {
        fontSize: 18,
        fontWeight: 900,
        color: TEXT,
      },

      badge: {
        fontSize: 12,
        fontWeight: 900,
        color: ORANGE,
        background: ORANGE_SOFT,
        border: `1px solid rgba(255,104,31,0.25)`,
        padding: "6px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      },

      cardDesc: {
        fontSize: 13,
        color: MUTED,
        lineHeight: 1.45,
        fontWeight: 600,
      },

      cardFooter: {
        marginTop: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      },

      open: {
        fontSize: 13,
        color: ORANGE,
        fontWeight: 900,
      },

      // Hover
      hovered: {
        transform: "translateY(-4px)",
        boxShadow: "0 16px 34px rgba(0,0,0,0.12)",
      },
    }),
    []
  );

  const primary = [
    {
      key: "players",
      title: "Players",
      desc: "Browse player profiles and season ratings quickly.",
      icon: "👤",
      badge: "Explore",
      onClick: () => navigate("/players"),
    },
    {
      key: "matches",
      title: "Matches",
      desc: "Upload match PDFs and review game performance.",
      icon: "⚽",
      badge: "Analyze",
      onClick: () => navigate("/matches"),
    },
    {
      key: "compare",
      title: "Compare",
      desc: "Compare two players side-by-side for decisions.",
      icon: "⚖️",
      badge: "Decide",
      onClick: () =>
        navigate("/compare", { state: { userTeam: userTeam, role: userRole } }),
    },
  ];

  const management = [
    {
      key: "teams",
      title: "Teams",
      desc: "Manage teams, coaches, and squad context.",
      icon: "🏟️",
      badge: "Manage",
      onClick: () =>
        navigate("/teams", { state: { userTeam: userTeam, userRole: userRole } }),
    },
    {
      key: "player-stats",
      title: "Player Stats",
      desc: "Add or update season stats (minutes, games, metrics).",
      icon: "📊",
      badge: "Update",
      onClick: () => navigate("/player-stats"),
    },
    {
      key: "season-grades",
      title: "Season Grades",
      desc: "Compute grades and generate scouting verdicts.",
      icon: "✅",
      badge: "Compute",
      onClick: () => navigate("/season-grades"),
    },
  ];

  const cardStyle = (key) => ({
    ...styles.card,
    ...(hovered === key ? styles.hovered : {}),
  });

  return (
    <div style={styles.page}>
      {/* Header (kept as you asked) */}
      <Header
        title={`Welcome back, ${username}👋`}
        subtitle="Scoutify · Manager workspace"
        role={userRole}
        team={userTeam}
        onLogout={handleLogout}
      />


      {/* Content */}
      <div style={styles.content}>
        {/* Lightweight manager hint (no DB reads) */}
        <div style={styles.topHint}>
          <div>
            <div style={styles.hintLeft}>
              <span style={{ fontSize: 18 }}>🧠</span>
              <span>Manager workspace</span>
            </div>
            <div style={styles.hintSub}>
              Fast access to decisions: players, matches, comparisons and grades.
            </div>
          </div>

          <div style={styles.hintPill}>
            Superliga Feminina 2025/2026
          </div>
        </div>

        {/* Primary */}
        <div style={styles.sectionRow}>
          <div style={styles.sectionTitle}>Daily workflow</div>
          <div style={styles.sectionHint}>Most used actions</div>
        </div>

        <div style={styles.grid}>
          {primary.map((c) => (
            <div
              key={c.key}
              style={cardStyle(c.key)}
              onMouseEnter={() => setHovered(c.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={c.onClick}
            >
              <div style={styles.accent} />
              <div style={styles.cardTop}>
                <div style={styles.titleWrap}>
                  <div style={styles.iconBubble}>{c.icon}</div>
                  <div style={styles.cardTitle}>{c.title}</div>
                </div>
                <div style={styles.badge}>{c.badge}</div>
              </div>

              <div style={styles.cardDesc}>{c.desc}</div>

              <div style={styles.cardFooter}>
                <span style={styles.open}>Open →</span>
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>
                  Quick access
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Management tools */}
        <div style={styles.sectionRow}>
          <div style={styles.sectionTitle}>Management & tools</div>
          <div style={styles.sectionHint}>Setup and computations</div>
        </div>

        <div style={styles.grid}>
          {management.map((c) => (
            <div
              key={c.key}
              style={cardStyle(c.key)}
              onMouseEnter={() => setHovered(c.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={c.onClick}
            >
              <div style={styles.accent} />
              <div style={styles.cardTop}>
                <div style={styles.titleWrap}>
                  <div style={styles.iconBubble}>{c.icon}</div>
                  <div style={styles.cardTitle}>{c.title}</div>
                </div>
                <div style={styles.badge}>{c.badge}</div>
              </div>

              <div style={styles.cardDesc}>{c.desc}</div>

              <div style={styles.cardFooter}>
                <span style={styles.open}>Open →</span>
                <span style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>
                  Admin module
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
