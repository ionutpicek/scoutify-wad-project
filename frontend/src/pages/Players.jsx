/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../firebase.jsx"; // your Firebase config file

const db = getFirestore(app);

const cardStyle = {
  backgroundColor: "#ffffff",
  borderRadius: 16,
  width: "17vw",
  border: "1px solid #FF681F",
  boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
  padding: "2vw",
  color: "#333333",
  textAlign: "center",
  transition: "transform 0.3s ease, box-shadow 0.3s ease",
  cursor: "pointer",
};

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [positions, setPositions] = useState([]);

  const navigate = useNavigate();

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

  const handleLogout = () => {
    navigate("/login");
  };

  useEffect(() => {
    const fetchData = async () => {
      // 🔹 Fetch players
      const playersSnapshot = await getDocs(collection(db, "player"));
      const playersList = playersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔹 Fetch teams
      const teamsSnapshot = await getDocs(collection(db, "team"));
      const teamsList = teamsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔹 Add team name to players
      const combined = playersList.map((player) => {
        const team = teamsList.find((t) => t.teamID === player.teamID);
        return {
          ...player,
          teamName: team ? team.name : "No Team",
        };
      });

      // 🔹 Extract unique positions for filter dropdown
      const uniquePositions = [
        ...new Set(playersList.map((p) => p.position || "Unknown")),
      ];

      setTeams(teamsList);
      setPlayers(combined);
      setPositions(uniquePositions);
    };

    fetchData();
  }, []);

  // 🔹 Apply filters
  const filteredPlayers = players.filter(
    (player) =>
      (selectedTeam === "" || player.teamName === selectedTeam) &&
      (selectedPosition === "" || player.position === selectedPosition)
  );

  return (
    <div style={{ backgroundColor: "#ffffff", width: "100vw", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Header */}
      <header style={headerStyle}>
        <button
      onClick={() => navigate(-1)} // 👈 Go back one page
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
        <span style={{ padding: "0 5vw" }}>Meet the Players</span>
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
          onClick={handleLogout}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#fff2e8")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "white")}
        >
          Logout
        </button>
      </header>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "2vw",
          margin: "4vh 0",
          flexWrap: "wrap",
        }}
      >
        {/* Team Filter */}
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          style={{
            padding: "10px 15px",
            borderRadius: 8,
            border: "1px solid #FF681F",
            backgroundColor: "#fff8f0",
            color: "#000",
            fontSize: 16,
          }}
        >
          <option value="">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.name}>
              {team.name}
            </option>
          ))}
        </select>

        {/* Position Filter */}
        <select
          value={selectedPosition}
          onChange={(e) => setSelectedPosition(e.target.value)}
          style={{
            padding: "10px 15px",
            borderRadius: 8,
            border: "1px solid #FF681F",
            backgroundColor: "#fff8f0",
            color: "#000",
            fontSize: 16,
          }}
        >
          <option value="">All Positions</option>
          {positions.map((pos, index) => (
            <option key={index} value={pos}>
              {pos}
            </option>
          ))}
        </select>
      </div>

      {/* Players Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          padding: "0 5vw 5vh 5vw",
          justifyItems: "center",
        }}
      >
        {filteredPlayers.length === 0 ? (
          <p style={{ color: "#555", textAlign: "center", gridColumn: "1 / -1" }}>
            No players match your filters.
          </p>
        ) : (
          filteredPlayers.map((player) => (
            <div
              key={player.id}
              style={cardStyle}
              onClick={() => navigate(`/player/${player.id}`)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <img
                src={player.photoURL || "/placeholder.png"}
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
              <p style={{ color: "#333", margin: 0 }}>{player.teamName}</p>
              <p style={{ color: "#777", margin: 0 }}>{player.position}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PlayersList;
