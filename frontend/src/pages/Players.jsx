import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection } from "firebase/firestore";
import { db, getDocsLogged as getDocs } from "../firebase.jsx";
import PlayerCard from "../components/PlayerCard.jsx";
import Spinner from "../components/Spinner.jsx";
import Header from "../components/Header.jsx";
import { getCurrentUser } from "../services/sessionStorage.js";

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [positions, setPositions] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true); 
  const storedUser = useMemo(() => getCurrentUser(), []);
  const isPlayerRole = storedUser?.role === "player";
  const isManagerRole = storedUser?.role === "manager";
  const playerDocId = storedUser?.playerDocId;
  const managerTeam = storedUser?.teamName || storedUser?.userTeam || "";

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
  const visiblePlayers = useMemo(() => {
    if (isPlayerRole && playerDocId) {
      return players.filter((player) => player.id === playerDocId);
    }
    if (isManagerRole && managerTeam) {
      return players.filter((player) => player.teamName === managerTeam);
    }
    return players;
  }, [players, isPlayerRole, playerDocId]);

  const filteredPlayers = visiblePlayers.filter(
      (player) =>
        (selectedTeam === "" || player.teamName === selectedTeam) &&
        (selectedPosition === "" || player.position === selectedPosition) &&
        (searchTerm === "" || player.name.toLowerCase().includes(searchTerm.toLowerCase()))

  );

  return (
    <div style={{ backgroundColor: "#ffffff", width: "100vw", minHeight: "100vh", overflowX: "hidden", boxSizing: "border-box" }}>
      <Header
        title="👤 Explore Players"
        subtitle="Browse and manage all players"
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

      {isPlayerRole && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "16px auto",
            padding: "12px",
            borderRadius: 12,
            border: "1px solid rgba(255,104,31,0.3)",
            backgroundColor: "#fff7ed",
            color: "#92400e",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          You can only browse your linked player profile. Use the search bar and filters to hone in
          on your own stats and match logs.
        </div>
      )}

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
