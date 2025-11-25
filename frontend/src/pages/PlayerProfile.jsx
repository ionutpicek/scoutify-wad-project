import {React, useEffect, useState} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc, getFirestore, query, collection, where, getDocs } from "firebase/firestore";
import { app } from "../firebase.jsx";
import profilePhoto from '../assets/download.jpeg';
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import superligaLogo from '../assets/superligaF.png';

const PlayerProfile = () => {
    const location = useLocation();
    const { playerID } = location.state || {};
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [playerData, setPlayerData] = useState(null);
    const [statsData, setStatsData] = useState(null);
    const [teamData, setTeamData] = useState([]);

    const numericPlayerID = Number(playerID);
    const db = getFirestore(app);
    const fieldPlayerStats = ["minutes", "assists", "dribbles", "goals", "passes", "shots"];
    const goalkeeperStats = ["minutes", "xCG", "conceded goals", "saves", "clean sheet","shot against","short goal kicks", "long goal kicks"];

    useEffect(() => {
        if (!playerID) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const playerRef = doc(db, "player", playerID);
                const playerSnap = await getDoc(playerRef);

                if (playerSnap.exists()) {
                    setPlayerData(playerSnap.data());
                } else {
                    console.warn("Player not found!");
                }

                const statsQuery = query(collection(db, "stats"), where("playerID", "==", numericPlayerID));
                const statsSnapshot = await getDocs(statsQuery);

                if (statsSnapshot.docs.length > 0) {
                    const stats = statsSnapshot.docs.map(doc => doc.data());
                    setStatsData(stats[0]); // take first stats object
                } else {
                    console.warn("No stats found for this player.");
                    setStatsData(null);
                }

                const teamData = query(collection(db, "team"), where("teamID", "==", playerSnap.data().teamID));
                const teamSnapshot = await getDocs(teamData);

                if (teamSnapshot.docs.length > 0) {
                    const stats = teamSnapshot.docs.map(doc => doc.data());
                    setTeamData(stats[0]); // take first stats object
                } else {
                    console.warn("No stats found for this player.");
                    setTeamData(null);
                }

            } catch (error) {
                console.error("Error fetching player:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [db, playerID, numericPlayerID]);

    if (isLoading) return <div style={{backgroundColor:"#fff", justifyContent:"center", display:"flex", height:"100vh", width:"100vw", alignItems:"center"}}>
                            <Spinner />
                          </div>
    if (!playerData) return <p>No player data found.</p>;

    const handleLogout = () => {
        navigate("/login");
    };

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
                    <p>Age: {getAge()}</p>
                    <p>Position: {playerData.position}</p>
                    <p>Playing for: {teamData.name}</p>
                </div>
                <img src={teamData.photoURL || superligaLogo}
                    style={{width:"15vw", borderRadius:"20px", height:"15vw", objectFit:"cover", marginTop:"2vh"}}>
                </img>
            </div>
        
            {statsData ? (
            <div style={{
                    flex: "1 1 25vw",
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    boxShadow: "4px 4px 12px rgba(0,0,0,0.2)",
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-around",
                    alignItems: "center",
                    color: "#aaa",
                    fontSize: "1.2rem",
                    width: "80vw",
                    margin: "3vh 8vw",
                    border: "1px solid #FF681F",
                    padding:"1vh 0vw"
                  }}>

                <h2 style={{flex:1, textAlign:"center"}}>Statistics</h2>
                {playerData.position.toLowerCase() === "goalkeeper" ? (
                    <div
                        style={{
                        flex: 3,
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",   // allows wrapping
                        gap: "1.5rem",      // space between items
                        justifyContent: "flex-start", // align left
                        }}
                    >
                        {goalkeeperStats.map((stat) => (
                        <p key={stat} style={{ margin: 0, width:"25%"}}>
                            {stat.charAt(0).toUpperCase() + stat.slice(1)}: {statsData[stat] ?? "-"}
                        </p>
                        ))}
                    </div>
                    ) : (
                    <div
                        style={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",   // allows wrapping
                        gap: "1.5rem",
                        justifyContent: "flex-start",
                        }}
                    >
                        {fieldPlayerStats.map((stat) => (
                        <p key={stat} style={{  margin: 0, width:"25%"}}>
                            {stat.charAt(0).toUpperCase() + stat.slice(1)}: {statsData[stat] ?? "-"}
                        </p>
                        ))}
                    </div>
                    )}

            </div>
            ) : (
            <div style={{ margin: "3vh 4vw", padding:"1vh 2vw", border: "1px solid #FF681F", borderRadius: "8px", backgroundColor: "#fffffd", color: "#000" }}>
                <p>No Statistics available for this player</p>
            </div>
            )}
        </div>
    );
}   

export default PlayerProfile;