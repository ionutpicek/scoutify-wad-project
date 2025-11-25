import React from "react";

const Header = ({ title, onBack, onLogout }) => {
  const headerStyle = {
    width: "100%",
    backgroundColor: "#FF681F",
    color: "white",
    height: "15vh",
    fontSize: 28,
    fontFamily: "cursive",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
  };

  return (
    <header style={headerStyle}>
      <button
        onClick={onBack}
        style={{
          backgroundColor: "#FF681F",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        ⬅ Back
      </button>

      <span style={{ padding: "0 5vw" }}>{title}</span>

      <button
        style={{
          backgroundColor: "white",
          color: "#FF681F",
          border: "none",
          padding: "8px 16px",
          borderRadius: 8,
          fontWeight: "bold",
          cursor: "pointer",
          marginRight: "5vw",
        }}
        onClick={onLogout}
        onMouseOver={(e) => (e.target.style.backgroundColor = "#fff2e8")}
        onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
      >
        Logout
      </button>
    </header>
  );
};

export default Header;