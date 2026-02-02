import React from  "react";

const shellStyle = {
  minHeight: "100vh",
  background: "#0f172a",
  color: "#f8fafc",
  padding: "4vh 5vw",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1vh",
};

export default function PlayerStatsMobile() {
  return (
    <div style={shellStyle}>
      <h1 style={{ margin: 0, fontSize: "5vw" }}>Player Stats</h1>
      <p style={{ fontSize: "3vw" }}>Mobile stats are being coordinated.</p>
    </div>
  );
}
