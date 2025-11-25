/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { app } from "../firebase.jsx";
import { useNavigate } from "react-router-dom";
import profilePhoto from '../assets/download.jpeg';
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";

const db = getFirestore(app);

function ComparePlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([null, null, null]);
  const [playerStats, setPlayerStats] = useState([null, null, null]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      // 🚀 Start loading
      setIsLoading(true);

      try {
        const snapshot = await getDocs(collection(db, "player"));
        const playerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlayers(playerList);
      } catch (error) {
        console.error("Error fetching players:", error);
      } finally {
        // ✅ Stop loading regardless of success or failure
        setIsLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  const handleSelectPlayer = async (index, playerID) => {
    const player = players.find(p => p.id === playerID);
    const newSelection = [...selectedPlayers];
    newSelection[index] = player;
    setSelectedPlayers(newSelection);

    // Fetch stats for this player
    // Check if playerID is valid before fetching stats
    if (!playerID) {
      const newStats = [...playerStats];
      newStats[index] = null;
      setPlayerStats(newStats);
      return;
    }

    const numericplayerID = Number(playerID);
    const statsQuery = query(collection(db, "stats"), where("playerID", "==", numericplayerID));
    const snapshot = await getDocs(statsQuery);
    const statsData = snapshot.docs[0]?.data() || null;

    const newStats = [...playerStats];
    newStats[index] = statsData;
    setPlayerStats(newStats);
  };

  const statFieldsPlayer = [ "minutes", "assists", "dribbles", "goals", "passes", "shots"]; // Add your desired stats here
  const statFieldsGoalkeeper = ["minutes", "xCG", "conceded goals", "saves", "clean sheet","shot against","short goal kicks", "long goal kicks"]; // Add your desired stats here
  // Determine which set of stats to display based on the selected players
  const statFields = selectedPlayers.some(p => p?.position === "Goalkeeper") ? statFieldsGoalkeeper : statFieldsPlayer;

  // Compute max for each stat to highlight
  const maxValues = statFields.map(field => {
    const values = playerStats.map(ps => ps?.[field] ?? -Infinity);
    return Math.max(...values);
  });

  const maxValues90 = statFields.map(field => {
    const values = playerStats.map(ps => ps ? (ps[field]*90)/ps["minutes"] : -Infinity);
    return Math.max(...values);
  });

  const getPlayerType = (player) => {
    if (!player) return null;
    return player.position === "Goalkeeper" ? "goalkeeper" : "outfield";
  };

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
      <Header
        title="Compare Players"
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

      {/* Conditional Content Rendering */}
      {isLoading ? (
        <Spinner />
      ) : (
        <>
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
                {players.filter((p) => {
                  const firstSelected = selectedPlayers.find(sp => sp);
                  const selectedType = getPlayerType(firstSelected);

                  if (!selectedType) return true; // no players chosen yet → show all
                  return getPlayerType(p) === selectedType; // show only same type (goalkeeper/outfield)
                })
                  .map((p) => (
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
                  <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-around", alignContent: "center", height: "15vh" }}>
                    <img src={player.photoURL || profilePhoto} alt={player.name} style={{ width: "8vw", height: "8vw", borderRadius: 12, marginBottom: "1vh", objectFit: "cover" }} />

                    <div style={{ textAlign: "start", justifyContent: "center", display: "flex", flexDirection: "column" }}>
                      <p style={{ color: "#FF681F", margin: "-1vh 0" }}>{player.name}</p>
                      <p style={{ color: "#555" }}>{player.position}</p>
                      <p style={{ color: "#000", margin: "-1vh 0" }}>
                        Birthdate: {
                          player.birthdate
                            ? typeof player.birthdate.toDate === "function"
                              ? player.birthdate.toDate().toLocaleDateString() // Firestore Timestamp
                              : new Date(player.birthdate).toLocaleDateString() // String
                            : "-"
                        }
                      </p>
                    </div>
                  </div>

                  {playerStats[idx] ? (
                    <>
                      <div style={{ width:"100%", fontWeight: 'bold', color: '#000',borderBottom: '1px solid #FF681F', display: 'flex', justifyContent: 'space-between', margin: '3vh 0 0 0' }}>
                        <span style={{ flex:1, textAlign:"left" }}>Stat</span>
                        <span style={{ flex:1, textAlign:"center" }}>Total</span>
                        <span style={{ flex:1, textAlign:"right" }}>Per 90</span>
                      </div>
                      
                      {statFields.map((field) => (
                        field === "minutes" ? (
                        <div key={field} style={{ display: "flex", justifyContent: "space-between", margin: "0.5vh 0vw", borderBottom: "1px solid #eee" }}>
                          <span style={{ flex:1, color: "#000", textAlign:"left" }}>{field}:</span>
                          <span style={{ flex:1, textAlign:"center" ,color: playerStats[idx][field] === maxValues[statFields.indexOf(field)] ? "#FF681F" : "#000" }}>{playerStats[idx][field] ?? "-"}</span>
                          <span style={{ flex:1, textAlign:"right", color:"#000"}}>-</span>
                        </div>
                        ) : (
                        <div key={field} style={{ display: "flex", justifyContent: "space-between", margin: "0.5vh 0", paddingBottom: "5px", borderBottom: "1px solid #eee", fontSize: '0.95em' }}>
                          <span style={{ textAlign:"left", color: "#000", flex:1 }}>{field}:</span>
                          <span style={{ felx:1,textAlign:"center", color: playerStats[idx][field] === maxValues[statFields.indexOf(field)] ? "#FF681F" : "#000" }}>{playerStats[idx][field] ?? "-"}</span>
                          <span style={{ flex:1,textAlign:"right", color: ((playerStats[idx][field]*90)/playerStats[idx]["minutes"]) === maxValues90[statFields.indexOf(field)] ? "#FF681F" : "#000"}}>{playerStats[idx][field] ? ((playerStats[idx][field]*90)/playerStats[idx]["minutes"]).toFixed(2) : "-"}</span>
                        </div>
                        )
                      ))}
                    </>
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
        </>
      )}
    </div>
  );
}

export default ComparePlayers;