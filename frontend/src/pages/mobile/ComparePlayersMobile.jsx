import React from  react;

const shellStyle = {
  minHeight: 100vh,
  background: #0b1120,
  color: #fef2f2,
  padding: 4vh 5vw,
  display: flex,
  flexDirection: column,
  alignItems: center,
  justifyContent: center,
  gap: 1vh,
};

export default function ComparePlayersMobile() {
  return (
    <div style={shellStyle}>
      <h1 style={{ margin: 0, fontSize: 5vw }}>Compare Players</h1>
      <p style={{ fontSize: 3vw }}>Mobile comparison is currently disabled.</p>
    </div>
  );
}
