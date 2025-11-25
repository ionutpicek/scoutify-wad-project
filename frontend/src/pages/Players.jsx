import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../firebase.jsx";
import PlayerCard from "../components/PlayerCard.jsx";
import Spinner from "../components/Spinner.jsx";
import Header from "../components/Header.jsx";

const db = getFirestore(app);

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [positions, setPositions] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true); 

  const navigate = useNavigate();

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
    <div style={{ backgroundColor: "#ffffff", width: "100vw", minHeight: "100vh", overflowX: "hidden", boxSizing: "border-box" }}>
      <Header
        title="Players"
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

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
            backgroundColor: "#fffffa",
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
            backgroundColor: "#fffffa",
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
            backgroundColor: "#fffffa",
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
          <PlayerCard
            key={player.id}
            player={player}
            onClick={() =>
              navigate(`/player-profile`, { state: { playerID: player.id } })
            }
            editable={false}
          />
        )))}
      </div>
    </div>
  );
}

export default PlayersList;