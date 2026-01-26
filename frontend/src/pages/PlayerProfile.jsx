import {React, useEffect, useState, useMemo} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, query, collection, where, orderBy } from "firebase/firestore";
import { db, getDocLogged as getDoc, getDocsLogged as getDocs } from "../firebase.jsx";
import profilePhoto from '../assets/download.jpeg';
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import superligaLogo from '../assets/superligaF.png';
import SeasonGradeCard from "../components/SeasonGradeCard";
import { getCurrentUser } from "../services/sessionStorage.js";


const PlayerProfile = () => {
    const location = useLocation();
    const { playerID } = location.state || {};
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [playerData, setPlayerData] = useState(null);
    const [statsData, setStatsData] = useState(null);
    const [teamData, setTeamData] = useState([]);
    const [matchesPlayed, setMatchesPlayed] = useState([]);
    const [physicalMetrics, setPhysicalMetrics] = useState(null);

    const normalize = str =>
      String(str || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\\s.]/g, "")
        .replace(/\\s+/g, " ")
        .trim();

    const storedUser = useMemo(() => getCurrentUser(), []);
    const isPlayerRole = storedUser?.role === "player";
    const isOwnProfile = !isPlayerRole || !storedUser?.playerDocId || storedUser.playerDocId === playerID;
    const isBlocked = isPlayerRole && !isOwnProfile;

    const handleLogout = () => {
        navigate("/login");
    };
    const StatCard = ({ label, value }) => {
        // Keep special stats intact
        const displayLabel = (() => {
          // Do not insert spaces for these tokens
          if (["xG", "xCG", "xA"].includes(label)) return label;
          if (/BPM/i.test(label)) return label;
          if (/km\/h/i.test(label)) return label;
          return label.charAt(0).toUpperCase() + label.slice(1).replace(/([A-Z])/g, " $1");
        })();

        return (
            <div style={{
            flex: "1 1 120px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
            padding: "8px 12px",
            textAlign: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}>
            <span style={{ fontSize: "0.85rem", color: "#888", marginBottom: "4px", display:"block" }}>
                {displayLabel}
            </span>
            <span style={{ fontSize: "1.1rem", fontWeight: "600", color: "#333" }}>
                {value ?? "-"}
            </span>
            </div>
        );
        };


    useEffect(() => {
        if (!playerID || isBlocked) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const playerRef = doc(db, "player", playerID);
                const playerSnap = await getDoc(playerRef);

                if (!playerSnap.exists()) {
                    console.warn("Player not found!");
                    setIsLoading(false);
                    return;
                }

                const player = playerSnap.data();
                setPlayerData(player);
                console.log("PlayerID:", player.playerID);

                const statsQuery = query(
                    collection(db, "stats"),
                    where("playerID", "==", player.playerID)
                );
                const statsSnapshot = await getDocs(statsQuery);

                if (statsSnapshot.docs.length > 0) {
                  const docSnap = statsSnapshot.docs[0];

                  const rawStats = docSnap.data();

                  const statsWithGrade = {
                    ...rawStats,
                    _statsDocId: docSnap.id, // keep it on stats

                    seasonGrade: rawStats.seasonGrade
                      ? {
                          ...rawStats.seasonGrade,
                          statsDocId: docSnap.id, // 🔑 inject here
                        }
                      : null,
                  };

                  setStatsData(statsWithGrade);
                }
                else {
                    console.warn("No stats found for this player.");
                    setStatsData(null);
                }

                const teamQuery = query(
                    collection(db, "team"),
                    where("teamID", "==", player.teamID)
                );
                const teamSnapshot = await getDocs(teamQuery);

                if (teamSnapshot.docs.length > 0) {
                    const teams = teamSnapshot.docs.map(doc => doc.data());
                    setTeamData(teams[0]);
                } else {
                    console.warn("No team found for this player.");
                    setTeamData(null);
                }

                // Fetch matches the player appeared in
                const matchesRef = collection(db, "matches");
                const matchesSnap = await getDocs(query(matchesRef, orderBy("date", "desc")));
                const played = [];
                const gpsStats = [];
                
                console.log("Total matches in DB:", matchesSnap.size);  
                matchesSnap.forEach(d => {
                  const data = d.data() || {};
                  const playersArr = Array.isArray(data.players) ? data.players : [];

                  const entry = playersArr.find(p => {
                    const pid = p.playerId ?? p.playerID;
                    const idMatch = pid != null && String(pid) === String(player.playerID);
                    if (idMatch) return true;
                    const nameMatch =
                      normalize(p.canonicalName || p.name || p.abbrName) === normalize(player.name) ||
                      normalize(p.name || "") === normalize(player.name) ||
                      normalize(p.abbrName || "") === normalize(player.name);
                    return nameMatch;
                  });

                  if (!entry) return;

                  const minutesVal = entry.minutesPlayed ?? entry.minutes ?? entry.totalMinutes ?? 0;
                  const positionVal = entry.position || entry.rolePlayed || entry.role || entry.pos || "";
                  const gradeVal =
                    entry.gameGrade?.overall10 ??
                    entry.gameGrade?.overall ??
                    entry.grade ??
                    entry.rating ??
                    null;

                  const entryTeamId = entry.teamId ?? entry.teamID ?? null;
                  const entrySide = entry.team || null;
                  const playerTeamId = entryTeamId ?? player.teamID ?? player.teamId ?? null;
                  const homeId = data.homeTeamId ?? data.homeTeamID ?? null;
                  const awayId = data.awayTeamId ?? data.awayTeamID ?? null;
                  const homeTeamName = data.homeTeam ?? "";
                  const awayTeamName = data.awayTeam ?? "";
                  const playerTeamName =
                    entrySide === "home"
                      ? homeTeamName
                      : entrySide === "away"
                        ? awayTeamName
                        : player.teamName || teamData?.name || "";

                  let oppName = "";
                  if (entrySide === "home") {
                    oppName = awayTeamName;
                  } else if (entrySide === "away") {
                    oppName = homeTeamName;
                  } else if (playerTeamId && (homeId || awayId)) {
                    if (homeId && String(playerTeamId) === String(homeId)) oppName = data.awayTeam;
                    else if (awayId && String(playerTeamId) === String(awayId)) oppName = data.homeTeam;
                  }
                  if (!oppName && playerTeamName) {
                    oppName = data.homeTeam === playerTeamName ? data.awayTeam : data.homeTeam;
                  }

                  const gameLabel = oppName ? `vs ${oppName}` : `${data.homeTeam} vs ${data.awayTeam}`;

                  played.push({
                    id: d.id,
                    gameName: gameLabel,
                    date: data.date || "",
                    minutes: Number(minutesVal) || 0,
                    position: positionVal,
                    grade: gradeVal != null ? Number(gradeVal) : null
                  });

                  if (entry.gps) {
                    gpsStats.push(entry.gps);
                  }
                });

                setMatchesPlayed(played);

                if (gpsStats.length) {
                  const kmVals = gpsStats
                    .map(g => g.kmPer90)
                    .filter(v => v != null && !Number.isNaN(v));
                  const speedVals = gpsStats
                    .map(g => g.topSpeedKmh)
                    .filter(v => v != null && !Number.isNaN(v));
                  const bpmVals = gpsStats
                    .map(g => g.avgBpm)
                    .filter(v => v != null && !Number.isNaN(v));

                  const avgKm90 = kmVals.length ? kmVals.reduce((a, b) => a + b, 0) / kmVals.length : null;
                  const topSpeed = speedVals.length ? Math.max(...speedVals) : null;
                  const avgBpm = bpmVals.length ? bpmVals.reduce((a, b) => a + b, 0) / bpmVals.length : null;
                  const sprints90 = gpsStats
                    .map(g => g.sprints)
                    .filter(v => v != null && !Number.isNaN(v));
                  const avgSprints = sprints90.length ? sprints90.reduce((a, b) => a + b, 0) / sprints90.length : null;

                  setPhysicalMetrics({
                    kmPer90: avgKm90,
                    topSpeedKmh: topSpeed,
                    avgBpm,
                    avgSprints
                  });
                } else {
                  setPhysicalMetrics(null);
                }
            } catch (error) {
                console.error("Error fetching player:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [playerID, isBlocked, teamData?.name]);

    if (isBlocked) {
        return (
            <div style={{backgroundColor:"#fff", minHeight:"100vh"}}>
                <Header
                    title="Access denied"
                    subtitle="You can only view your own profile."
                    onBack={() => navigate(-1)}
                    onLogout={handleLogout}
                />
                <div style={{maxWidth:"600px", margin:"40px auto", padding:"20px", borderRadius:"14px", border:"1px solid #ffcc80", backgroundColor:"#fff8f0", color:"#994c00"}}>
                    You are logged in as a player and can only see your own statistics. Contact an admin if you need a different profile linked.
                </div>
            </div>
        );
    }

    if (isLoading) return <div style={{backgroundColor:"#fff", justifyContent:"center", display:"flex", height:"100vh", width:"100vw", alignItems:"center"}}>
                            <Spinner />
                          </div>
    if (!playerData) return <p>No player data found.</p>;

    const getAge = () => {
        if (!playerData || !playerData.birthdate) return "N/A";

        let birthDate;

        // If Firestore Timestamp
        if (playerData.birthdate.toDate) {
            birthDate = playerData.birthdate.toDate();
        } 
        // If already a string or JS Date
        else {
            birthDate = new Date(playerData.birthdate);
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age--;
        }

        return age;
        };

      const dateFormat = (date) => {
        if (!date) return "N/A";
        const [y, m, d] = String(date).split("-");
        if (!y || !m || !d) return date;
        return `${d}/${m}/${y}`;
      }

      const statsAvailable = Boolean(statsData);
      const statsInfoText = statsAvailable
        ? `${statsData.minutes ?? 0} minutes played in ${statsData.games ?? 0} games`
        : "Not available yet";
      const statsPeriodText =
        statsAvailable && statsData?.firstGameDate && statsData?.lastGameDate
          ? `${dateFormat(statsData.firstGameDate)} - ${dateFormat(statsData.lastGameDate)}`
          : "N/A";
      const teamName = teamData?.name || "N/A";
      const teamPhoto = teamData?.photoURL || superligaLogo;

    console.log("Matches played:", matchesPlayed);

    return (
        <div style={{ backgroundColor:"#fff", overflowX: "hidden", boxSizing: "border-box", width:"100vw", height:"100vh" }}>
            <Header
                title={playerData.name}
                onBack={() => navigate(-1)}
                onLogout={handleLogout}
            />

            <div style={{margin:"1vh 2vw", display:"flex", flexWrap:"wrap",flexDirection:"row", alignItems:"center", justifyContent:"space-around"}}>
                <img src={playerData.photoURL || profilePhoto}
                    style={{width:"20vw", borderRadius:"40px", height:"20vw", objectFit:"cover", marginTop:"2vh"}}>
                </img> 
                <div style={{color:"#000"}}>
                    <p>Name: {playerData.name}</p>
                    <p>Nationality: {playerData.nationality}</p>
                    <p>Age: {getAge()}</p>
                    <p>Playing for: {teamName}</p>
                    <p>Stats info: {statsInfoText}</p>
                    <p>Stats period: {statsPeriodText}</p>
                </div>
                <img src={teamPhoto}
                    style={{width:"15vw", borderRadius:"20px", height:"15vw", objectFit:"cover", marginTop:"2vh"}}>
                </img>
            </div>

            {statsAvailable ? (
              <>
                <SeasonGradeCard
                  seasonGrade={statsData.seasonGrade}
                  statsDocId={statsData._statsDocId}
                  matchesPlayed={matchesPlayed}
                />
                <div style={{
                  width: "85vw",
                  margin: "3vh auto",
                  padding: "20px",
                  borderRadius: "16px",
                  backgroundColor: "#fff",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                  border: "2px solid #FF681F",
                }}>
                  <h2 style={{
                    textAlign: "center",
                    marginBottom: "16px",
                    color: "#FF681F",
                    fontSize: "1.6rem",
                    fontWeight: "600",
                  }}>Statistics</h2>

                  {playerData.position.toLowerCase() !== "goalkeeper" ? (
                    <>
                      {/* Offensive Stats */}
                      <h3 style={{ color: "#FF681F", marginBottom: "8px" }}>Offensive</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["goals","assists","shots","shotsOnTarget","xG","touchesInPenaltyArea","offsides","progressiveRuns"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      {/* Passing Stats */}
                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Passing</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["passes","accuratePasses","longPasses","longPassesAccurate","crosses","crossesAccurate","throughPasses","throughPassesAccurate","xA","secondAssists","passesFinalThird","passesFinalThirdAccurate","passesPenaltyArea","passesPenaltyAreaAccurate","receivedPasses","forwardPasses","forwardPassesAccurate","backPasses","backPassesAccurate"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      {/* Dribbling */}
                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Dribbling</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["dribbles","dribblesSuccessful","progressiveRuns"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      {/* Duels */}
                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Duels</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["duels","duelsWon","aerialDuels","aerialDuelsWon","offensiveDuels","offensiveDuelsWon","defensiveDuels","defensiveDuelsWon","looseBallDuels","looseBallDuelsWon","slidingTackles","slidingTacklesSuccessful"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      {/* Defensive */}
                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Defensive</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["interceptions","lossesOwnHalf","recoveriesOppHalf","clearances","fouls"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      {/* Discipline */}
                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Discipline</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["yellowCards","redCards","foulsSuffered"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Goalkeeper Stats */}
                      <h3 style={{ color: "#FF681F", marginBottom: "8px" }}>Goalkeeping</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["saves","reflexSaves","concededGoals","xCG","shotsAgainst"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Distribution</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["passes","accuratePasses","longPasses","longPassesAccurate","goalKicks","shortGoalKicks","longGoalKicks"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>

                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Other</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        {["minutes","exits"].map(stat => (
                          <StatCard key={stat} label={stat} value={statsData[stat]} />
                        ))}
                      </div>
                    </>
                  )}

                  {physicalMetrics && (
                    <>
                      <h3 style={{ color: "#FF681F", margin: "16px 0 8px 0" }}>Physical metrics</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                        <StatCard label="Km / 90" value={physicalMetrics.kmPer90 != null ? physicalMetrics.kmPer90.toFixed(2) : "-"} />
                        <StatCard label="Top speed (km/h)" value={physicalMetrics.topSpeedKmh != null ? physicalMetrics.topSpeedKmh.toFixed(1) : "-"} />
                        <StatCard label="Avg BPM" value={physicalMetrics.avgBpm != null ? physicalMetrics.avgBpm.toFixed(0) : "-"} />
                        <StatCard label="Sprints" value={physicalMetrics.avgSprints != null ? physicalMetrics.avgSprints.toFixed(0) : "-"} />
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                margin: "3vh 4vw",
                padding: "12px 20px",
                border: "2px solid #FF681F",
                borderRadius: "12px",
                backgroundColor: "#fff8f0",
                textAlign: "center",
                color: "#333",
              }}>
                <p>No statistics available for this player</p>
              </div>
            )}
        </div>
    );
}   

export default PlayerProfile;
