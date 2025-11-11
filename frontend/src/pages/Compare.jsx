/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { app } from "../firebase.jsx";
import { useNavigate } from "react-router-dom";

const db = getFirestore(app);

function ComparePlayers() {
    const navigate = useNavigate();
    const [players, setPlayers] = useState([]);
    const [selectedPlayers, setSelectedPlayers] = useState([null, null, null]);
    const [playerStats, setPlayerStats] = useState([null, null, null]);
    

  useEffect(() => {
    const fetchPlayers = async () => {
      const snapshot = await getDocs(collection(db, "player"));
      const playerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlayers(playerList);
    };
    fetchPlayers();
  }, []);

  

  const handleSelectPlayer = async (index, playerID) => {
    const player = players.find(p => p.id === playerID);
    const newSelection = [...selectedPlayers];
    newSelection[index] = player;
    setSelectedPlayers(newSelection);

    // Fetch stats for this player
    const numericplayerID = Number(playerID);
    const statsQuery = query(collection(db, "stats"), where("playerID", "==", numericplayerID));
    const snapshot = await getDocs(statsQuery);
    const statsData = snapshot.docs[0]?.data() || null;

    const newStats = [...playerStats];
    newStats[index] = statsData;
    setPlayerStats(newStats);
  };

  const statFields = ["assists", "dribbles", "goals", "minutes", "passes", "shots"]; // Add your desired stats here

  // Compute max for each stat to highlight
  const maxValues = statFields.map(field => {
    const values = playerStats.map(ps => ps?.[field] ?? -Infinity);
    return Math.max(...values);
  });

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
        <span style={{ padding: "0 5vw" }}>Feelings or facts?</span>
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

      {/* Player Selection */}
      <div style={{ display: "flex", gap: "2vw", marginBottom: "4vh", justifyContent: "center", padding: "4vh 0" }}>
        {selectedPlayers.map((player, idx) => (
          <select
            key={idx}
            value={player ? player.id : ""}
            onChange={e => handleSelectPlayer(idx, e.target.value)}
            style={{
              padding: "10px 15px",
              borderRadius: 8,
              border: "1px solid #FF681F",
              backgroundColor: "#fff8f0",
              color: "#000",
              fontSize: 16,
            }}
          >
            <option value="">Select Player {idx + 1}</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ))}
      </div>

        {/* Comparison Stats */}
      <div style={{ display: "flex", gap: "2vw", flexWrap: "wrap", justifyContent: "center", padding: "0 2vw 4vh 2vw" }}>
        {selectedPlayers.map((player, idx) =>
          player ? (
            <div
              key={idx}
              style={{
                flex: "1 1 25vw",
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: "2vw",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                minWidth: "200px",
              }}
            >
            <div style={{display:"flex", flexDirection:"row", justifyContent:"space-around", alignContent:"center", height:"15vh"}}>
              <img src={player.photoURL || "/placeholder.png"} alt={player.name} style={{ width: "8vw", height:"8vw", borderRadius: 12, marginBottom: "1vh", objectFit:"cover" }} />
              
              <div style={{textAlign:"start", justifyContent:"center", display:"flex", flexDirection:"column"}}>
                <p style={{ color: "#FF681F", margin:"-1vh 0" }}>{player.name}</p>
                <p style={{ color: "#555" }}>{player.position}</p>
                <p style={{color:"#000", margin:"-1vh 0"}}>Birthdate: {player.birthdate ? player.birthdate.toDate().toLocaleDateString(): "-"}</p>{" "} 
              </div>
            </div>

              {playerStats[idx] ? (
                statFields.map((field, sIdx) => (

                  <p key={field}>
                    <span style={{color:"#000000"}}>{field.charAt(0).toUpperCase() + field.slice(1)}:</span>{" "}
                    <span style={{ color: playerStats[idx][field] === maxValues[sIdx] ? "#FF681F" : "#000" }}>
                      {playerStats[idx][field] ?? "-"}
                    </span>
                  </p>
                ))
              ) : (
                <p style={{ color: "#aaa" }}>No stats available</p>
              )}
            </div>
          ) : (
            <div
              key={idx}
              style={{
                flex: "1 1 25vw",
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: "2vw",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                minWidth: "200px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#aaa",
              }}
            >
              Select a player
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default ComparePlayers;