import React from "react";
import { clearCurrentUser } from "../services/sessionStorage.js";

const ORANGE = "#FF681F";

const headerStyle = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  backgroundColor: ORANGE,
  color: "white",
  boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
};

const headerInner = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const leftGroup = { display: "flex", alignItems: "center", gap: 12 };

const leftWrap = { display: "flex", flexDirection: "column", gap: 6 };

const titleStyle = { fontSize: 26, fontWeight: 800, letterSpacing: 0.3 };

const subtitleStyle = { fontSize: 14, opacity: 0.9 };

const rightWrap = { display: "flex", alignItems: "center", gap: 12 };

const backButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  borderRadius: 12,
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.45)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: "1",
  outline: "none",
  WebkitTapHighlightColor: "transparent",
};

const backIcon = { width: 32, height: 32, display: "block", transform: "scale(3)" };

const pill = {
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.35)",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const logoutBtn = {
  background: "white",
  color: ORANGE,
  border: "none",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
};

export function Header({
  title,
  subtitle,
  role,
  team,
  onLogout,
  onBack,
}) {
  const handleLogout = () => {
    clearCurrentUser();
    if (typeof onLogout === "function") {
      onLogout();
    }
  };

  return (
    <header style={headerStyle}>
      <div style={headerInner}>
        <div style={leftGroup}>
          {onBack ? (
            <button
              type="button"
              style={backButton}
              onClick={onBack}
              aria-label="Go back"
              title="Go back"
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.3)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.18)")
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={backIcon}>
                <path
                  d="M14.7 5.3a1 1 0 0 1 0 1.4L9.4 12l5.3 5.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : null}
          <div style={leftWrap}>
            <div style={titleStyle}>{title}</div>
            {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
          </div>
        </div>

        <div style={rightWrap}>
          {role || team ?
            <div style={{display:"flex", flexDirection:"row", gap:10}}>
              <div style={pill}>👔 {role || "Role —"}</div>
              <div style={pill}>🏷️ {team || "Team —"}</div>
            </div>
            :
          null}
          
          <button
            style={logoutBtn}
            onClick={handleLogout}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF2E8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
