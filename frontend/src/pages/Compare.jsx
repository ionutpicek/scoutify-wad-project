import React, { useEffect, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { db, getDocsLogged as getDocs } from "../firebase.jsx";
import { useNavigate } from "react-router-dom";
import profilePhoto from '../assets/download.jpeg';
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";

function ComparePlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([null, null, null]);
  const [playerStats, setPlayerStats] = useState([null, null, null]);
  const [searchQueries, setSearchQueries] = useState(["", "", ""]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      setIsLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "player"));
        const playerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlayers(playerList);
      } catch (error) {
        console.error("Error fetching players:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  const getPlayerType = (player) => {
    if (!player) return null;
    return player.position === "Goalkeeper" ? "goalkeeper" : "outfield";
  };

  const handleSearchChange = (index, value) => {
    const newQueries = [...searchQueries];
    newQueries[index] = value;
    setSearchQueries(newQueries);
  };

  const handleSelectPlayer = async (index, playerID) => {
    const player = players.find(p => p.id === playerID);

    if (!playerID) {
      const newSelection = [...selectedPlayers];
      newSelection[index] = null;
      setSelectedPlayers(newSelection);

      const newStats = [...playerStats];
      newStats[index] = null;
      setPlayerStats(newStats);

      const newQueries = [...searchQueries];
      newQueries[index] = "";
      setSearchQueries(newQueries);
      return;
    }

    const playerType = getPlayerType(player);

    const newSelection = selectedPlayers.map((p, i) =>
      i === index ? player : (p && getPlayerType(p) !== playerType ? null : p)
    );
    setSelectedPlayers(newSelection);

    const newQueries = [...searchQueries];
    newQueries[index] = "";
    setSearchQueries(newQueries);

    const statsQuery = query(collection(db, "stats"), where("playerID", "==", player.playerID));
    const snapshot = await getDocs(statsQuery);
    const statsData = snapshot.docs[0]?.data() || null;

    const newStats = [...playerStats];
    newStats[index] = statsData;

    newSelection.forEach((p, i) => {
      if (!p) newStats[i] = null;
    });

    setPlayerStats(newStats);
  };

  const fieldPlayerStatsGrouped = {
    "Attacking": ["goals","assists","shots","shotsOnTarget","xG","shotAssists","secondAssists","offsides","touchesInPenaltyArea","progressiveRuns", "totalActions","successfulActions","dribbles","dribblesSuccessful"],
    "Passing": ["passes","accuratePasses","longPasses","longPassesAccurate","crosses","crossesAccurate","throughPasses","throughPassesAccurate","passesFinalThird","passesFinalThirdAccurate","passesPenaltyArea","passesPenaltyAreaAccurate","receivedPasses","forwardPasses","forwardPassesAccurate","backPasses","backPassesAccurate","xA"],
    "Defensive": ["duels","duelsWon","aerialDuels","aerialDuelsWon","interceptions","lossesOwnHalf","recoveriesOppHalf","defensiveDuels","defensiveDuelsWon","looseBallDuels","looseBallDuelsWon","slidingTackles","slidingTacklesSuccessful","clearances","fouls","foulsSuffered","yellowCards","redCards"],
    "Other": ["yellowCards","redCards","foulsSuffered"]
  };

  const goalkeeperStatsGrouped = {
    "Defending": ["concededGoals","xCG","shotsAgainst","saves","reflexSaves","exits","goalKicks","shortGoalKicks","longGoalKicks"],
    "Passing": ["longPasses","longPassesAccurate","shortPasses","shortPassesAccurate","passesAccurate","assists"],
    "Other": ["dribbles","dribblesSuccessful","duels","duelsWon","aerialDuels","aerialDuelsWon","interceptions","lossesOwnHalf","recoveriesOppHalf","yellowCards","redCards"]
  };

  const statGroups = selectedPlayers.some(p => p?.position === "Goalkeeper") ? goalkeeperStatsGrouped : fieldPlayerStatsGrouped;

  const maxValuesPerField = (field) => {
    return Math.max(...playerStats.map(ps => ps?.[field] ?? -Infinity));
  };

  const maxValuesPer90 = (field) => {
    return Math.max(...playerStats.map(ps => ps ? (ps[field]*90)/ps["minutes"] : -Infinity));
  };

  const handleLogout = () => navigate("/login");

  const filteredPlayers = (index) => {
    const query = searchQueries[index].toLowerCase();
    const typeFilter = selectedPlayers.find(sp => sp)?.position;
    return players
      .filter(p => p.name.toLowerCase().includes(query))
      .filter(p => !typeFilter || getPlayerType(p) === (typeFilter === "Goalkeeper" ? "goalkeeper" : "outfield"));
  };

  const formatFieldName = (field) => {
    if(field === "xG" || field === "xCG" || field === "xA") return field;
    return field.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
  };

  const handleClearSelection = (index) => handleSelectPlayer(index, null);

  return (
    <div style={{ backgroundColor: "#ffffff", width: "100vw", minHeight: "100vh", overflowX: "hidden" }}>
      <Header
        title={`⚖️ Compare Players`}
        subtitle="Compare two players side-by-side for decisions."
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

      {isLoading ? <Spinner /> : (
        <>
          {/* Player selectors */}
          <div style={{ display: "flex", gap: "2vw", marginBottom: "4vh", justifyContent: "center", padding: "4vh 0" }}>
            {selectedPlayers.map((player, idx) => {
              const availablePlayers = filteredPlayers(idx);
              return (
                <div key={idx} style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder={`Search Player ${idx + 1}`}
                    value={searchQueries[idx]}
                    onChange={e => handleSearchChange(idx, e.target.value)}
                    style={{ padding: "10px 15px", borderRadius: 8, border: "1px solid #FF681F", backgroundColor: "#fff8f0", color: "#000", fontSize: 16, width: "200px" }}
                  />
                  {searchQueries[idx] && availablePlayers.length > 0 && (
                    <div style={{ position: "absolute", top: "45px", left: 0, background: "#fff", border: "1px solid #ddd", borderRadius: 6, maxHeight: "200px", overflowY: "auto", zIndex: 100, color:"#000" }}>
                      {availablePlayers.map(p => (
                        <div key={p.id} onClick={() => handleSelectPlayer(idx, p.id)} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #eee" }}>
                          {p.name} ({p.position})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Player comparison cards */}
          <div style={{ display: "flex", gap: "2vw", flexWrap: "wrap", justifyContent: "center", padding: "0 2vw 4vh 2vw" }}>
            {selectedPlayers.map((player, idx) => player ? (
              <div key={idx} style={{ flex: "1 1 25vw", backgroundColor: "#fff", borderRadius: 12, padding: "2vw", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: "250px" }}>
                {/* Player Info */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.2vw",
                    padding: "1vh 1vw",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {/* Player photo */}
                  <img
                    src={player.photoURL || profilePhoto}
                    alt={player.name}
                    style={{
                      width: "6.5vw",
                      height: "6.5vw",
                      minWidth: "6.5vw",
                      borderRadius: 12,
                      objectFit: "cover",
                    }}
                  />

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      flex: 1,
                      gap: "0.4vh",
                    }}
                  >
                    <p
                      style={{
                        color: "#FF681F",
                        fontWeight: 600,
                        fontSize: "1.05rem",
                        margin: 0,
                        whiteSpace:"nowrap"
                      }}
                    >
                      {player.name}
                    </p>

                    <p style={{ color: "#555", margin: 0, fontSize: "0.95rem" }}>
                      {player.nationality}
                    </p>

                    <p style={{ color: "#777", margin: 0, fontSize: "0.85rem" }}>
                      Born:{" "}
                      {player.birthdate
                        ? typeof player.birthdate.toDate === "function"
                          ? player.birthdate.toDate().toLocaleDateString()
                          : new Date(player.birthdate).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>

                  {/* Grade block */}
                  <div>
                    <div style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "0.4vw",
                      whiteSpace: "nowrap",
                    }}>
                    <span style={{ color: "#FF681F", fontWeight: 700, fontSize: "1.2rem" }}>
                      {playerStats[idx]?.seasonGrade?.overall10?.toFixed(1) ?? "-"}
                    </span>

                    <span style={{ color: "#555", fontSize: "0.9rem" }}>/10</span>
                    </div>
                    <div style={{justifyContent:"center", display:"flex", gap:10}}>
                      <button onClick={() => handleClearSelection(idx)} style={{ background:"#FF681F", border:"none", borderRadius:6, color:"#fff", padding:"5px 10px", cursor:"pointer"}}>Clear</button>
                    </div>
                  </div>
                </div>

                
                <div style={{height:"150px", display:"flex", justifyContent:"space-around", marginTop:0, flexDirection:"column"}}>
                <p style={{ color:"#000", fontSize:16, margin:"3px 0" }}>
                  Stats period:{" "}
                  {playerStats[idx]?.firstGameDate && playerStats[idx]?.lastGameDate
                    ? `${new Date(playerStats[idx].firstGameDate).toLocaleDateString()} — ${new Date(playerStats[idx].lastGameDate).toLocaleDateString()}`
                    : "unknown"}
                </p>

                <p style={{ color:"#000", fontSize:16, margin:"3px 0"}}>
                  Minutes Played: {playerStats[idx]?.minutes ?? 0} ({playerStats[idx]?.games ?? 0} games)
                </p>

                <p style={{ color:"#000", fontSize:16, margin:"3px 0"}}>
                  Role Graded: {playerStats[idx]?.seasonGrade?.role}
                </p>

                <p style={{color:"#000", fontSize:16, margin:"3px 0"}}>
                  Played Positions: {playerStats[idx]?.positions?.join(", ") ?? "Unknown"}
                </p>
                </div>

                {/* Stats */}
                {playerStats[idx] ? Object.entries(statGroups).map(([groupName, fields]) => (
                  <div key={groupName} style={{ marginTop:"0vh" }}>
                    <h4 style={{ color:"#FF681F", borderBottom:"1px solid #FF681F", paddingBottom:"2px" }}>{groupName}</h4>
                    <div style={{
                      display:"grid",
                      gridTemplateColumns:"repeat(3, 1fr)",
                      rowGap:"0",      // no extra gap, we'll use border for separation
                      columnGap:"10px",
                      marginTop:"5px"
                    }}>
                      {fields.map(field => (
                        <React.Fragment key={field}>
                          <div style={{ textAlign:"left", color:"#000", borderBottom: "1px solid #eee", padding: "2px 0" }}>{formatFieldName(field)}</div>
                          <div style={{ textAlign:"center", color: playerStats[idx][field] === maxValuesPerField(field) ? "#FF681F" : "#000", borderBottom: "1px solid #eee", padding: "2px 0" }}>{playerStats[idx][field] ?? "-"}</div>
                          <div style={{ textAlign:"right", color: playerStats[idx][field] && ((playerStats[idx][field]*90)/playerStats[idx]["minutes"]) === maxValuesPer90(field) ? "#FF681F" : "#000", borderBottom: "1px solid #eee", padding: "2px 0" }}>
                            {playerStats[idx][field] ? ((playerStats[idx][field]*90)/playerStats[idx]["minutes"]).toFixed(2) : "-"}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )) : <p style={{ color:"#aaa" }}>No stats available</p>}

              </div>
            ) : (
              <div key={idx} style={{ flex: "1 1 25vw", backgroundColor: "#fff", borderRadius: 12, padding: "2vw", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", minWidth:"250px", display:"flex", justifyContent:"center", alignItems:"center", color:"#aaa" }}>
                Select a player
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ComparePlayers;
