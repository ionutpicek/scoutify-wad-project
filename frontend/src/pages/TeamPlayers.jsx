import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../firebase.jsx";
import { query, where } from "firebase/firestore";
import profilePhoto from '../assets/download.jpeg';


const TeamPlayers = () => {
    const location = useLocation();
    const { teamID, teamName, teamCoach } = location.state || {};
    const navigate = useNavigate();
    const [players, setPlayers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const Spinner = () => (
        <div
            style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh", // Center vertically in a large area
            // gridColumn is not needed here since the parent div is a simple grid, 
            // but we'll ensure it centers well.
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
    const db = getFirestore(app);

    useEffect(() => {
        if (!teamID) return;

        const fetchPlayers = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "player"), where("teamID", "==", teamID));
            const snapshot = await getDocs(q);
            const teamPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlayers(teamPlayers);
        } catch (error) {
            console.error("Error fetching team players:", error);
        } finally {
            setIsLoading(false);
        }
        };

        fetchPlayers();
    }, [db, teamID]);
    
    const handleLogout = () => {
        navigate("/login");
    };

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

    return (
        <div style={{ backgroundColor: "#fff", width: "100vw", minHeight:"100vh" }}>
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

                <span style={{ padding: "0 5vw" }}>{teamName}</span>
                
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

            <div style={{display:"flex", flexDirection:"row", justifyContent:"center", alignItems:"center", padding:"2vh 6vw", fontSize:20}}>
                <p style={{color:"#000", flex:1, textAlign:"left"}}>Coach : {teamCoach}</p>
                <p style={{color:"#000", flex:1, textAlign:"center"}}>Position this season : 1</p>
                <p style={{color:"#000", flex:1, textAlign:"right"}}>Number of players : {players.length}</p>
            </div>
            
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
                ) : players.length === 0 ? (
                  <p style={{ color: "#555", textAlign: "center", gridColumn: "1 / -1" }}>
                    No players in this team.
                  </p>
                ) : (
                  players.map((player) => (
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
};

export default TeamPlayers;