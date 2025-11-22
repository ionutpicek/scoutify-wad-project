import {React, useEffect, useState} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc, getFirestore, query, collection, where, getDocs } from "firebase/firestore";
import { app } from "../firebase.jsx";


const PlayerProfile = () => {
    const location = useLocation();
    const { playerID } = location.state || {};
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [playerData, setPlayerData] = useState(null);
    const [statsData, setStatsData] = useState(null);

    const numericPlayerID = Number(playerID);
    const db = getFirestore(app);

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

                // Fetch player stats
                const statsQuery = query(collection(db, "stats"), where("playerID", "==", numericPlayerID));
                const statsSnapshot = await getDocs(statsQuery);

                if (statsSnapshot.docs.length > 0) {
                    const stats = statsSnapshot.docs.map(doc => doc.data());
                    setStatsData(stats[0]); // take first stats object
                } else {
                    console.warn("No stats found for this player.");
                    setStatsData(null);
                }

            } catch (error) {
                console.error("Error fetching player:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [db, playerID, numericPlayerID]);

    if (isLoading) return <p>Loading player data...</p>;
    if (!playerData) return <p>No player data found.</p>;

    return (
        <div style={{ backgroundColor:"#fff", minHeight: "100vh", padding: "20px", width: "100vw" }}>
            <h1>Player Profile</h1>
            <p style={{color:"#000"}}>Player ID: {playerID}</p>
            <p style={{color:"#000"}}>Name: {playerData.name}</p>
            <button onClick={() => navigate(-1)}>Go Back</button>
        
            {statsData ? (
            <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #FF681F", borderRadius: "8px", backgroundColor: "#fff8f0", color: "#000" }}>
                <h2>Statistics</h2>
                <p>Goals: {statsData.goals}</p>
                <p>Assists: {statsData.assists}</p>
            </div>
            ) : (
                <p style={{color:"#000"}}>No statistics available for this player.</p>
            )}
        </div>
    );
}   

export default PlayerProfile;