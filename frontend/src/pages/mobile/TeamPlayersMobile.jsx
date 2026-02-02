import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { collection, deleteDoc, doc, addDoc, setDoc, query, where } from "firebase/firestore"; 
import { db, getDocsLogged as getDocs } from "../../firebase.jsx"; 
import Header from "../../components/Header.jsx"; 
import Spinner from "../../components/Spinner.jsx";
import PlayerCardMobile from "../../components/PlayerCardMobile.jsx";

const TeamPlayersMobile = () => { 
        const location = useLocation(); 
        const { teamID, teamName } = location.state || {}; 
        const navigate = useNavigate(); 
        const [players, setPlayers] = useState([]); 
        const [isLoading, setIsLoading] = useState(true); 
        const [editingPlayer, setEditingPlayer] = useState(null); // player object currently being edited 
        const [formInputs, setFormInputs] = useState({ name: "", position: "", photoURL: "", birthdate: "", moveTeamID: "", }); 
        const [teamsList, setTeamsList] = useState([]);
        const [viewMode, setViewMode] = useState("players");
                            
        useEffect(() => {
            if (editingPlayer) {
            setFormInputs({
                name: editingPlayer.name || "",
                nationality: editingPlayer.nationality || "",
                position: editingPlayer.position || "",
                photoURL: editingPlayer.photoURL || "",
                birthdate: editingPlayer.birthdate || "",
                moveTeamID: "",
            });
        }
            }, [editingPlayer]);

        const [deleteP, setDeletePlayer] = useState(false); 
        const [playerToDelete, setPlayerToDelete] = useState(null); 

        const handleDelete = async () => { try { 
            if (!playerToDelete) return;

            await deleteDoc(doc(db, "player", playerToDelete.id)); 
            const q = query(collection(db, "stats"), where("playerID", "==", playerToDelete.playerID)); 
            const snap = await getDocs(q); snap.forEach(docItem => deleteDoc(doc(db, "stats", docItem.id))); 
            
            // remove from stats 
            setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerToDelete.id)); 
            console.log("Player removed successfully!"); setDeletePlayer(false); 
        } catch (error) { console.error("Error deleting player:", error); } }; 
        
        const handleCancel = () => {
            setPlayerToDelete(null);
            setDeletePlayer(false);
        };

        const [add, setAdd] = useState(false); 

        const abbr = (fullName) => {
            const parts = fullName.split(" ");
            const abbrName = `${parts[0][0]}. ${parts[parts.length - 1]}`;
            return abbrName;
        }

        const handleAdd = async (info) => {
            try {
                const playerID = Date.now();

                // add player document
                const playerRef = await addDoc(collection(db, "player"), {
                    name: info.name,
                    teamID: info.teamID,
                    position: info.position,
                    photoURL: info.photoURL || "",
                    teamName: info.teamName,
                    birthdate: info.birthdate || "",
                    nationality: info.nationality, 
                    playerID: playerID,
                    abbrName: abbr(info.name),
                });

                // add stats document
                await addDoc(
                    collection(db, "stats"),
                    info.position !== "Goalkeeper"
                        ? { playerID: playerID, minutes: 0, goals: 0, assists: 0, shots: 0, passes: 0, dribbles: 0 }
                        : { playerID: playerID, minutes: 0, xCG: 0, concededGoals: 0, saves: 0, cleanSheet: 0, shotAgainst: 0, shortGoalKicks: 0, longGoalKicks: 0 }
                );

                // update local state immediately (or you can fetch all players again)
                setPlayers(prevPlayers => [
                    ...prevPlayers,
                    {
                        id: playerRef.id,  // unique Firestore doc ID
                        name: info.name,
                        teamID: info.teamID,
                        position: info.position,
                        photoURL: info.photoURL || "",
                        teamName: info.teamName,
                        birthdate: info.birthdate || "",
                        nationality: info.nationality,
                        playerID: playerID,
                    },
                ]);

            } catch (error) {
                console.error("Error adding player:", error);
            }
        };

            
        const editPlayer = async (playerID, updatedInfo) => { 
            const playerRef = doc(db, "player", playerID); 
            await setDoc(playerRef, updatedInfo, { merge: true }); 
        } 
        
        useEffect(() => { 
            if (!teamID) return;
        
        const fetchPlayers = async () => { 
            setIsLoading(true); 
            try { 
                const q = query(collection(db, "player"), where("teamID", "==", teamID));
                const snapshot = await getDocs(q); 
                const teamPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // fetch season grades for these players (chunked by 10 for Firestore 'in' constraint)
                const playerIds = teamPlayers.map(p => p.playerID).filter(Boolean);
                const statsCol = collection(db, "stats");
                const gradeByPlayer = new Map();
                for (let i = 0; i < playerIds.length; i += 10) {
                    const chunk = playerIds.slice(i, i + 10);
                    const sq = query(statsCol, where("playerID", "in", chunk));
                    const ssnap = await getDocs(sq);
                    ssnap.forEach(d => {
                        const data = d.data() || {};
                        const pid = data.playerID;
                        const sg = data.seasonGrade?.overall10 ?? null;
                        if (pid != null && sg != null) gradeByPlayer.set(pid, sg);
                    });
                }

                const merged = teamPlayers.map(p => ({
                    ...p,
                    seasonGradeOverall: gradeByPlayer.get(p.playerID) ?? null,
                }));

                setPlayers(merged); 
            } catch (error) { 
                console.error("Error fetching team players:", error); 
            } finally {
                setIsLoading(false); 
                } 
            }; 
            fetchPlayers(); 
        }, [ teamID]); 

        useEffect(() => {
            const fetchTeams = async () => {
                try {
                    const snapshot = await getDocs(collection(db, "team"));
                    setTeamsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } catch (error) {
                    console.error("Error fetching teams:", error);
                }
            };
            fetchTeams();
        }, []);
        
        const handleLogout = () => { navigate("/login"); }; 
       
    return (
        <div style={{ backgroundColor: "#fff", width: "100vw", minHeight:"100vh" }}>
            <Header
                title={teamName}
                onBack={() => navigate(-1)}
                onLogout={handleLogout}
            />

                <div style={teamHeaderRight}>
                    <div style={viewSwitchContainer}>
                        <button
                            type="button"
                            onClick={() => setViewMode("players")}
                            style={viewSwitchButton(viewMode === "players")}
                        >
                            Players
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("teamStyle")}
                            style={viewSwitchButton(viewMode === "teamStyle")}
                        >
                            Team Style of Play
                        </button>
                    </div>
                </div>
            
            {add && (
               <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: "white",
                        borderRadius: 16,
                        padding: 30,
                        width: "60vw",
                        display: "flex",
                        flexDirection: "column",
                        borderColor: "3px solid #FF681F",
                        gap: 10,
                    }}>
                        <h2 style={{ color: "#FF681F" }}>Add Player</h2>
                    
                    <input 
                        type="text" 
                        placeholder="Name"
                        value={formInputs.name || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, name: e.target.value})}
                    />
                    <input 
                        type="text" 
                        placeholder="Nationality"
                        value={formInputs.nationality || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, nationality: e.target.value})}
                    />
                    <select
                        value={formInputs.position || ""}
                        style={{
                            height: "4vh",
                            borderRadius: 8,
                            color: "#000",
                            backgroundColor: "#fff",
                            borderColor: "#FF681F",
                            paddingLeft: 10,
                        }}
                        onChange={(e) => setFormInputs({ ...formInputs, position: e.target.value })}
                    >
                        <option value="">Select Position</option>
                        <option value="Striker">Striker</option>
                        <option value="Midfielder">Midfielder</option>
                        <option value="Defender">Defender</option>
                        <option value="Goalkeeper">Goalkeeper</option>
                    </select>

                    <input 
                        type="text" 
                        placeholder="Photo URL"
                        value={formInputs.photoURL || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, photoURL: e.target.value})}
                    />
                    <input 
                        type="date" 
                        placeholder="Birth Date"
                        value={formInputs.birthdate || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, birthdate: e.target.value})}
                    />

                    <button onClick={() => {
                        setAdd(false);
                        setFormInputs({ name: "", position: "", photoURL: "", birthdate: "" });}}>
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            if (!formInputs.name || !formInputs.position || !formInputs.birthdate || !formInputs.nationality) {
                            alert("Please fill in Name, Position, Birthdate and Nationality");
                            return;
                        } else {
                            const birthYear = new Date(formInputs.birthdate).getFullYear();
                            const currentYear = new Date().getFullYear();
                            if (currentYear - birthYear > 50) {
                                alert("Players older than 50 years are not allowed.");
                                return;
                            }
                            if( currentYear - birthYear < 0){
                                alert("Player not born yet");
                                return;
                            }
                        }

                            await handleAdd({
                            name: formInputs.name,
                            teamID: teamID,
                            position: formInputs.position,
                            photoURL: formInputs.photoURL,
                            teamName: teamName,
                            birthdate: formInputs.birthdate,
                            nationality: formInputs.nationality
                            });

                            setAdd(false);
                            setFormInputs({ name: "", position: "", photoURL: "", birthdate: "" });
                        }}
                        >
                        Add
                        </button>



                    </div>
                </div>)
            }

            {editingPlayer && (
            <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
            }}>
                <div style={{
                    backgroundColor: "white",
                    borderRadius: 16,
                    padding: 30,
                    width: "40vw",
                    display: "flex",
                    flexDirection: "column",
                    borderColor: "3px solid #FF681F",
                    gap: 10,
                }}>
                    <h2 style={{ color: "#FF681F" }}>Edit Player</h2>
                    
                    <input 
                        type="text" 
                        placeholder="Name"
                        value={formInputs.name || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, name: e.target.value})}
                    />

                    <input 
                        type="text" 
                        placeholder="Nationality"
                        value={formInputs.nationality || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, nationality: e.target.value})}
                    />

                    <select
                        value={formInputs.position || ""}
                        style={{
                            height: "4vh",
                            borderRadius: 8,
                            color: "#000",
                            backgroundColor: "#fff",
                            borderColor: "#FF681F",
                            paddingLeft: 10,
                        }}
                        onChange={(e) => setFormInputs({ ...formInputs, position: e.target.value })}
                    >
                        <option value="">Select Position</option>
                        <option value="Striker">Striker</option>
                        <option value="Midfielder">Midfielder</option>
                        <option value="Defender">Defender</option>
                        <option value="Goalkeeper">Goalkeeper</option>
                    </select>

                    <input 
                        type="text" 
                        placeholder="Photo URL"
                        value={formInputs.photoURL || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, photoURL: e.target.value})}
                    />

                    <input 
                        type="date" 
                        placeholder="Birth Date"
                        value={formInputs.birthdate || ""}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, birthdate: e.target.value})}
                    />

                    <label style={{ fontSize: "0.9rem", color: "#444", marginTop: "12px" }}>Move to another team</label>
                    <select
                        value={formInputs.moveTeamID || ""}
                        style={{
                            height: "4vh",
                            borderRadius: 8,
                            color: "#000",
                            backgroundColor: "#fff",
                            borderColor: "#FF681F",
                            paddingLeft: 10,
                        }}
                        onChange={(e) => setFormInputs({ ...formInputs, moveTeamID: e.target.value })}
                    >
                        <option value="">Keep current team</option>
                        {teamsList.map(team => (
                            <option key={team.teamID || team.id} value={String(team.teamID ?? team.id)}>
                                {team.name}
                            </option>
                        ))}
                    </select>

                    <button onClick={async () => {
                        const updatedData = {
                            ...editingPlayer, // keep old data
                            ...Object.fromEntries(
                                Object.entries(formInputs)
                                    .filter(([key, value]) => key !== "moveTeamID" && value !== "")
                            )
                        };

                        if (formInputs.moveTeamID) {
                            const targetTeam = teamsList.find(
                                team => String(team.teamID ?? team.id) === formInputs.moveTeamID
                            );
                            if (targetTeam) {
                                updatedData.teamID = targetTeam.teamID ?? targetTeam.id;
                                updatedData.teamName = targetTeam.name;
                            }
                        }

                        await editPlayer(editingPlayer.id, updatedData);

                        setEditingPlayer(null);
                        setFormInputs({ name: "", position: "", photoURL: "", birthdate: "", nationality:"", moveTeamID: "" });

                        // Refresh player list
                        const q = query(collection(db, "player"), where("teamID", "==", teamID));
                        const snapshot = await getDocs(q);
                        setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    }}>
                        Save
                    </button>

                    </div>
                </div>
            )}

            {deleteP && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: "white",
                        borderRadius: 16,
                        padding: 30,
                        width: "25vw",
                        display: "flex",
                        flexDirection: "column",
                        borderColor: "3px solid #FF681F",
                        gap: 10,
                    }}>
                        <p style={{color:"#000"}}>Are you sure you want to delete this player?</p>
                        <button onClick={handleCancel} style={{backgroundColor:"#000"}}>Cancel</button>
                        <button onClick={handleDelete} style={{backgroundColor:"red"}}>Delete</button>
                    </div>
                </div>)
            }

            {viewMode === "players" ? (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 20,
                        padding: "0 5vw 5vh 5vw",
                        justifyItems: "center",
                    }}
                >
                    {isLoading ? (
                        <Spinner />
                    ) : players.length === 0 ? (
                        <p style={{ color: "#555", textAlign: "center", gridColumn: "1 / -1" }}>
                            No players in this team.
                        </p>
                    ) : (
                        players.map((player) => (
                            <PlayerCardMobile
                                key={player.id}
                                player={player}
                                onClick={() =>
                                    navigate(`/player-profile`, { state: { playerID: player.id } })
                                }
                            />
                        ))
                    )}
                </div>
            ) : (
                <div style={teamStylePlaceholder}>
                    <p style={teamStylePlaceholderText}>
                        Team style of play view will be configured here.
                    </p>
                </div>
            )}
        </div>
    );
};


const teamHeaderRight = {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
};

const viewSwitchContainer = {
    display: "flex",
    justifyContent: "center",
    width: "80vw",
    gap: 10,
    padding: "1.5vh 0vw 1.5vh 0vw",
};

const viewSwitchButton = (active) => ({
    borderRadius: 90,
    padding: "12px 16px",
    border: active ? "1px solid #FF681F" : "1px solid #ddd",
    background: active ? "#fff6ee" : "#fff",
    color: "#111",
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: active ? "0 5px 14px rgba(255,104,31,0.25)" : "none",
    transition: "all 0.2s ease",
});

const teamStylePlaceholder = {
    minHeight: "60vh",
    margin: "0 5vw 5vh 5vw",
    borderRadius: 16,
    border: "1px dashed rgba(255,104,31,0.7)",
    background: "#fffaf5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const teamStylePlaceholderText = {
    color: "#666",
    fontSize: 16,
    fontWeight: 600,
};

export default TeamPlayersMobile;
  