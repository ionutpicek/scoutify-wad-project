// src/components/PlayerCard.jsx
import React from "react";
import profilePhoto from "../assets/download.jpeg";

const PlayerCard = ({
  player,
  onClick = () => {},
  onEdit = null,
  onRemove = null,
  highlight = false,
  style = {},
}) => {
  if (!player) return null;

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        width: "17vw",
        border: highlight ? "2px solid #FF681F" : "1px solid #FF681F",
        boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
        padding: "2vw",
        color: "#333",
        textAlign: "center",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
        cursor: "pointer",
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <img
        src={player.photoURL || profilePhoto}
        alt={player.name}
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          objectFit: "cover",
          marginBottom: 12,
          border: "3px solid #FF681F",
        }}
      />
      <h2 style={{ color: "#FF681F", marginBottom: 8 }}>{player.name}</h2>
      <p style={{ color: "#777", margin: 0 }}>{player.position}</p>

      {(onEdit || onRemove) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            marginTop: "1vh",
            gap: 10,
          }}
        >
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(player);
              }}
              style={{ backgroundColor: "#FF681F" }}
            >
              Edit
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(player);
              }}
              style={{ backgroundColor: "#FF681F" }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerCard;
