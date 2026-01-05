import React from "react";

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

const leftWrap = { display: "flex", flexDirection: "column", gap: 6 };

const titleStyle = { fontSize: 26, fontWeight: 800, letterSpacing: 0.3 };

const subtitleStyle = { fontSize: 14, opacity: 0.9 };

const rightWrap = { display: "flex", alignItems: "center", gap: 12 };

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
}) {
  return (
    <header style={headerStyle}>
      <div style={headerInner}>
        <div style={leftWrap}>
          <div style={titleStyle}>{title}</div>
          {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
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
            onClick={onLogout}
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