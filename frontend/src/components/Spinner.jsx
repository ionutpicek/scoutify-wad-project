import React from "react";

const Spinner = ({ message = "Loading..." }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "50vh", // Center vertically in a large area
        width: "100%",
      }}
    >
      <div
        style={{
          border: "5px solid #f3f3f3", // Light grey border
          borderTop: "5px solid #FF681F", // Orange border for the spinning part
          borderRadius: "50%",
          width: "50px",
          height: "50px",
          animation: "spin 1s linear infinite",
          marginBottom: "10px",
        }}
      />
      <p style={{ color: "#FF681F" }}>{message}</p>

      {/* Add keyframes for spin animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Spinner;