import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { getTeams } from "../api/teams.js";
import { addPlayer, deletePlayer, editPlayer, getTeamPlayers } from "../services/playerServices.jsx";
import Header from "../components/Header.jsx"; 
import Spinner from "../components/Spinner.jsx";
import PlayerCard from "../components/PlayerCard.jsx";
import {
    getTeamReport,
    regenerateTeamReport,
    uploadTeamReportPdf
} from "../api/ai.js";

const TeamPlayers = () => { 
        const location = useLocation(); 
        const { teamID, teamName, teamCoach } = location.state || {}; 
        const role = location.state.role; 
        const userTeam = location.state.userTeam; 
        const navigate = useNavigate(); 
        const [players, setPlayers] = useState([]); 
        const [isLoading, setIsLoading] = useState(true); 
        const [editingPlayer, setEditingPlayer] = useState(null); // player object currently being edited 
        const [formInputs, setFormInputs] = useState({ name: "", position: "", photoURL: "", birthdate: "", moveTeamID: "", }); 
        const [teamsList, setTeamsList] = useState([]);
        const [viewMode, setViewMode] = useState("players");
        const [teamReport, setTeamReport] = useState(null);
        const [teamReportLoading, setTeamReportLoading] = useState(false);
        const [teamReportRefreshing, setTeamReportRefreshing] = useState(false);
        const [teamReportUploading, setTeamReportUploading] = useState(false);
        const [teamReportUploadFile, setTeamReportUploadFile] = useState(null);
        const [teamReportError, setTeamReportError] = useState(null);
                            
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
        const deletePlayer = () => { setDeletePlayer(prev => !prev); }

        const handleDelete = async () => { try { 
            if (!playerToDelete) return;
            await deletePlayer(playerToDelete.id, playerToDelete.playerID);
            setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerToDelete.id)); 
            console.log("Player removed successfully!"); setDeletePlayer(false); 
        } catch (error) { console.error("Error deleting player:", error); } }; 
        
        const handleCancel = () => {
            setPlayerToDelete(null);
            setDeletePlayer(false);
        };

        const [add, setAdd] = useState(false); 

        const startAdd = () => { 
            setAdd(prev => !prev); 
        }

        const handleAdd = async (info) => {
            try {
                const created = await addPlayer({
                    name: info.name,
                    teamID: info.teamID,
                    position: info.position,
                    photoURL: info.photoURL || "",
                    teamName: info.teamName,
                    birthdate: info.birthdate || "",
                    nationality: info.nationality,
                });
                if (created) {
                    setPlayers(prevPlayers => [...prevPlayers, created]);
                }

            } catch (error) {
                console.error("Error adding player:", error);
            }
        };

            
        const [edit, setEdit] = useState(false); 
        const changeEdit = () => { setEdit(prev => !prev); } 
        useEffect(() => { 
            if (!teamID) return;
        
        const fetchPlayers = async () => { 
            setIsLoading(true); 
            try { 
                const teamPlayers = await getTeamPlayers(teamID);
                setPlayers(teamPlayers); 
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
                    const list = await getTeams();
                    setTeamsList(list);
                } catch (error) {
                    console.error("Error fetching teams:", error);
                }
            };
            fetchTeams();
        }, []);
        
        useEffect(() => {
            let cancelled = false;
            if (viewMode !== "teamReport" || !teamID) {
                setTeamReport(null);
                setTeamReportError(null);
                setTeamReportLoading(false);
                return;
            }

            setTeamReportLoading(true);
            setTeamReportError(null);
            setTeamReport(null);

            getTeamReport(teamID, { regenerate: false })
                .then(data => {
                    if (cancelled) return;
                    setTeamReport(data);
                })
                .catch(error => {
                    if (cancelled) return;
                    setTeamReportError(error.message || "Unable to load team report.");
                })
                .finally(() => {
                    if (cancelled) return;
                    setTeamReportLoading(false);
                });

            return () => {
                cancelled = true;
            };
        }, [viewMode, teamID]);

        const handleRegenerateTeamReport = async () => {
            if (role !== "admin" || !teamID || teamReportRefreshing) return;
            setTeamReportRefreshing(true);
            setTeamReportError(null);
            try {
                const data = await regenerateTeamReport(teamID);
                setTeamReport(data);
            } catch (error) {
                setTeamReportError(error.message || "Unable to regenerate team report.");
            } finally {
                setTeamReportRefreshing(false);
            }
        };

        const handleUploadTeamReportPdf = async () => {
            if (role !== "admin" || !teamID || !teamReportUploadFile || teamReportUploading) return;
            setTeamReportUploading(true);
            setTeamReportError(null);
            try {
                const data = await uploadTeamReportPdf(teamID, teamReportUploadFile);
                setTeamReport(data);
                setTeamReportUploadFile(null);
            } catch (error) {
                setTeamReportError(error.message || "Unable to upload report PDF.");
            } finally {
                setTeamReportUploading(false);
            }
        };
        
        const handleLogout = () => { navigate("/login"); }; 
        const isTeamReportView = viewMode === "teamReport";
       
    return (
        <div style={{ backgroundColor: "#fff", width: "100vw", minHeight:"100vh" }}>
            <Header
                title={teamName}
                onBack={() => navigate(-1)}
                onLogout={handleLogout}
            />

            <div style={isTeamReportView ? teamHeaderRowReport : teamHeaderRow}>
                <div style={isTeamReportView ? teamHeaderLeftReport : teamHeaderLeft}>
                    <p style={isTeamReportView ? coachLabelReport : coachLabelReport}>Coach: {teamCoach}</p>
                </div>
                <div style={isTeamReportView ? teamHeaderCenterReport : teamHeaderCenter}>
                    {viewMode === "players" &&
                        ((role === "manager" && teamName === userTeam) || role === "admin") && (
                            <div style={playerActionButtons}>
                                <button onClick={changeEdit} style={{ }}>
                                    Edit Players
                                </button>
                                <button onClick={startAdd} style={{ marginLeft: 10 }}>
                                    Add Player
                                </button>
                            </div>
                        )}
                    {viewMode === "teamReport" && role === "admin" && (
                        <div style={teamStyleActions}>
                            <button
                                type="button"
                                onClick={handleRegenerateTeamReport}
                                disabled={teamReportLoading || teamReportRefreshing}
                                style={regenerateButton(teamReportLoading || teamReportRefreshing)}
                            >
                                {teamReportRefreshing ? "Regenerating..." : "Regenerate report"}
                            </button>
                            <label style={uploadReportButton}>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    style={{ display: "none" }}
                                    onChange={event => setTeamReportUploadFile(event.target.files?.[0] || null)}
                                />
                                {teamReportUploadFile ? "PDF selected" : "Choose PDF"}
                            </label>
                            <button
                                type="button"
                                onClick={handleUploadTeamReportPdf}
                                disabled={!teamReportUploadFile || teamReportUploading}
                                style={regenerateButton(!teamReportUploadFile || teamReportUploading)}
                            >
                                {teamReportUploading ? "Uploading..." : "Upload to report"}
                            </button>
                        </div>
                    )}
                </div>
                <div style={isTeamReportView ? teamHeaderRightReport : teamHeaderRight}>
                    <div style={isTeamReportView ? viewSwitchContainerReport : viewSwitchContainer}>
                        <button
                            type="button"
                            onClick={() => setViewMode("players")}
                            style={viewSwitchButton(viewMode === "players")}
                        >
                            Players
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("teamReport")}
                            style={viewSwitchButton(viewMode === "teamReport")}
                        >
                            Team Report
                        </button>
                    </div>
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
                        const refreshed = await getTeamPlayers(teamID);
                        setPlayers(refreshed);
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
                            <PlayerCard
                                key={player.id}
                                player={player}
                                onClick={() =>
                                    navigate(`/player-profile`, { state: { playerID: player.id } })
                                }
                                onEdit={edit ? (p) => setEditingPlayer(p) : null}
                                onRemove={edit ? (p) => { setPlayerToDelete(p); deletePlayer(); } : null}
                            />
                        ))
                    )}
                </div>
            ) : (
                <>
                    {teamReportLoading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "5vh 0" }}>
                            <Spinner />
                        </div>
                    ) : teamReportError ? (
                        <div style={teamStylePlaceholder}>
                            <p style={teamStylePlaceholderText}>{teamReportError}</p>
                        </div>
                    ) : teamReport?.report ? (
                        <div style={teamReportContainer}>
                            <div style={teamStyleHeader}>
                                <p style={teamStyleLabel}>{teamReport.report.reportTitle || "Team Report"}</p>
                                <span style={teamStyleMatches}>
                                    Matches analyzed: {teamReport.report.matchesAnalyzed ?? 0}
                                </span>
                            </div>

                            <p style={teamStyleSummaryText}>{teamReport.report.executiveSummary}</p>

                            {teamReport.report.supplementalInsights?.length ? (
                                <div style={teamReportSectionCard}>
                                    <div style={teamReportSectionTitle}>
                                        Supplemental PDFs ({teamReport.report.supplementalInsights.length})
                                    </div>
                                    <ul style={teamReportList}>
                                        {teamReport.report.supplementalInsights.map(item => (
                                            <li key={item.id || item.sourceName} style={teamReportListItem}>
                                                {item.sourceName}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {teamReport.report.keyMetrics?.length ? (
                                <div style={teamStyleHighlights}>
                                    {teamReport.report.keyMetrics.map((item, index) => (
                                        <div key={`metric-${index}`} style={teamStyleHighlightItem}>
                                            <div style={teamStyleHighlightValue}>{item.value}</div>
                                            <div style={teamStyleHighlightLabel}>{item.label}</div>
                                            <div style={teamStyleHighlightNote}>{item.whyItMatters}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {teamReport.report.sections?.map(section => (
                                <div key={section.title} style={teamReportSectionCard}>
                                    <div style={teamReportSectionTitle}>{section.title}</div>
                                    <ul style={teamReportList}>
                                        {section.findings?.map((point, index) => (
                                            <li key={`${section.title}-${index}`} style={teamReportListItem}>
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}

                            <div style={teamReportColumns}>
                                <div style={teamReportColumnCard}>
                                    <div style={teamReportSectionTitle}>Strengths</div>
                                    <ul style={teamReportList}>
                                        {teamReport.report.strengths?.map((point, index) => (
                                            <li key={`strength-${index}`} style={teamReportListItem}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div style={teamReportColumnCard}>
                                    <div style={teamReportSectionTitle}>Weaknesses</div>
                                    <ul style={teamReportList}>
                                        {teamReport.report.weaknesses?.map((point, index) => (
                                            <li key={`weakness-${index}`} style={teamReportListItem}>{point}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div style={teamReportSectionCard}>
                                <div style={teamReportSectionTitle}>Opponent Game Plan</div>
                                <ul style={teamReportList}>
                                    {teamReport.report.opponentGamePlan?.map((point, index) => (
                                        <li key={`plan-${index}`} style={teamReportListItem}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div style={teamStylePlaceholder}>
                            <p style={teamStylePlaceholderText}>
                                Team report will be generated once this view is opened.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const teamHeaderRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2vh 6vw",
    gap: 12,
};

const teamHeaderRowReport = {
    ...teamHeaderRow,
    margin: "1.5vh 5vw 1.5vh 5vw",
    padding: "16px 20px",
    borderRadius: 16,
    border: "1px solid #f2d7c8",
    background: "linear-gradient(180deg, #fff9f4 0%, #fff 100%)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.04)",
};

const teamHeaderLeft = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
};

const teamHeaderLeftReport = {
    ...teamHeaderLeft,
    minWidth: 220,
};

const teamHeaderCenter = {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
};

const teamHeaderCenterReport = {
    ...teamHeaderCenter,
    justifyContent: "flex-start",
};

const teamHeaderRight = {
    flex: 1,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
};

const teamHeaderRightReport = {
    ...teamHeaderRight,
    flex: 1.2,
};

const coachLabel = {
    color: "#000",
    margin: 0,
    fontSize: 20,
    fontWeight: 400
};

const coachLabelReport = {
    ...coachLabel,
    fontSize: 18,
    fontWeight: 600,
    color: "#1f1f1f",
};

const playerActionButtons = {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
    whiteSpace: "nowrap",
};

const viewSwitchContainer = {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    padding: "1.5vh 0vw 1.5vh 0vw",
};

const viewSwitchContainerReport = {
    ...viewSwitchContainer,
    gap: 8,
    padding: 0,
};

const viewSwitchButton = (active) => ({
    borderRadius: 999,
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

const teamStyleHeader = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    paddingBottom: 12,
    borderBottom: "1px solid #f0e2d7"
};

const teamStyleLabel = {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: "#111"
};

const teamStyleMatches = {
    fontSize: 14,
    color: "#777"
};

const teamStyleSummaryText = {
    margin: 0,
    color: "#333",
    fontSize: 15,
    lineHeight: 1.65
};

const teamStyleHighlights = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12
};

const teamStyleHighlightItem = {
    padding: "12px 14px 14px 14px",
    borderRadius: 12,
    background: "linear-gradient(180deg, #fff 0%, #fffaf6 100%)",
    border: "1px solid #f2dfd1",
    borderTop: "3px solid #FF8A4D",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 7,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
};

const teamStyleHighlightValue = {
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.4,
    color: "#FF681F"
};

const teamStyleHighlightLabel = {
    fontSize: 12,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5
};

const teamStyleHighlightNote = {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.45
};

const teamReportContainer = {
    minHeight: "60vh",
    margin: "0 5vw 5vh 5vw",
    borderRadius: 16,
    border: "1px solid #f1dac9",
    background: "linear-gradient(180deg, #fffbf8 0%, #fff 100%)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 12px 30px rgba(0,0,0,0.05)"
};

const teamReportSectionCard = {
    background: "#fff",
    borderRadius: 12,
    padding: "14px 16px",
    border: "1px solid #f0dfd3",
    borderLeft: "4px solid #ffc7a7",
    boxShadow: "0 6px 18px rgba(0,0,0,0.03)"
};

const teamReportSectionTitle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#222",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.3
};

const teamReportList = {
    margin: 0,
    paddingLeft: 20,
    display: "flex",
    flexDirection: "column",
    gap: 6
};

const teamReportListItem = {
    color: "#333",
    lineHeight: 1.45,
    fontSize: 14
};

const teamReportColumns = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12
};

const teamReportColumnCard = {
    background: "#fff",
    borderRadius: 12,
    padding: "14px 16px",
    border: "1px solid #f0dfd3",
    boxShadow: "0 6px 18px rgba(0,0,0,0.03)"
};

const teamStyleActions = {
    display: "flex",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 8,
};

const uploadReportButton = {
    borderRadius: 999,
    width: "fit-content",
    whiteSpace: "nowrap",
    textAlign: "center",
    border: "1px solid #FF681F",
    padding: "8px 14px",
    background: "#fff",
    color: "#FF681F",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
};

const regenerateButton = disabled => ({
    borderRadius: 999,
    border: "1px solid #FF681F",
    padding: "8px 12px",
    background: disabled ? "#ffe6d7" : "#FF681F",
    color: disabled ? "#a74f1f" : "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
});

export default TeamPlayers;
    
