import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../firebase.jsx"; // your Firebase config file
import profilePhoto from '../assets/download.jpeg';

const db = getFirestore(app);

// 🔄 Spinner Component (Inline styled for simplicity)
const Spinner = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "50vh", // Center vertically in a large area
      gridColumn: "1 / -1", // Makes it span all columns in the grid layout
        flexDirection:"column",
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
        // Using a style tag for the keyframes in the global CSS is cleaner,
        // but for a quick inline solution, we rely on a utility class or inject styles.
        // For this example, we'll assume a global CSS keyframe is available or use a library.
      }}
    />
    <p style={{ color: "#FF681F" }}>Loading players...</p>
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
  // 🆕 New state for loading status
  const [isLoading, setIsLoading] = useState(true); 

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
      // 🚀 Start loading
      setIsLoading(true); 
      
      try {
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
      } catch (error) {
        console.error("Error fetching data:", error);
        // Handle error display to user if necessary
      } finally {
        // ✅ Stop loading regardless of success or failure
        setIsLoading(false); 
      }
    };

    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Apply filters
  const filteredPlayers = players.filter(
    (player) =>
      (selectedTeam === "" || player.teamName === selectedTeam) &&
      (selectedPosition === "" || player.position === selectedPosition) &&
      (searchTerm === "" || player.name.toLowerCase().includes(searchTerm.toLowerCase()))

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
          alignItems: "center", // vertically align items
        }}
      >
        <input
          type="text"
          placeholder="Search player by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "1vh 1.5vh",
            borderRadius: 8,
            border: "1px solid #FF681F",
            width: "20vw",
            fontSize: 16,
            outline: "none",
            color: "#000",
            backgroundColor: "#fff8f0",
            height: "6vh",
            boxSizing: "border-box",
          }}
        />

        {/* Team Filter */}
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          disabled={isLoading}
          style={{
            padding: "1vh 1.5vh",
            borderRadius: 8,
            border: "1px solid #FF681F",
            backgroundColor: "#fff8f0",
            color: "#000",
            fontSize: 16,
            height: "6vh",
            boxSizing: "border-box",
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
          disabled={isLoading}
          style={{
            padding: "1vh 1.5vh",
            borderRadius: 8,
            border: "1px solid #FF681F",
            backgroundColor: "#fff8f0",
            color: "#000",
            fontSize: 16,
            height: "6vh",
            boxSizing: "border-box",
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


      {/* Players Grid / Loading View */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          padding: "0 5vw 5vh 5vw",
          justifyItems: "center",
        }}
      >
        {/* 🆕 Conditional Rendering for Loading State */}
        {isLoading ? (
          <Spinner />
        ) : filteredPlayers.length === 0 ? (
          <p style={{ color: "#555", textAlign: "center", gridColumn: "1 / -1" }}>
            No players match your filters.
          </p>
        ) : (
          filteredPlayers.map((player) => (
            <div
              key={player.id}
              style={cardStyle}
              onClick={() => navigate(`/player-profile`, { state: { playerID: player.id } })}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
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