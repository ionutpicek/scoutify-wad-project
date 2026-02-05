/* eslint-disable no-unused-vars */
import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Spinner from '../../components/Spinner.jsx';
import Header from '../../components/Header.jsx';
import teamPhoto from '../../assets/superligaF.png';
import coach_placeholder from '../../assets/download.jpeg';
import { getTeams, createTeam, updateTeam, deleteTeam as deleteTeamApi } from "../../api/teams.js";

function TeamsPage() {
  const location = useLocation();
  const userRole = location.state?.userRole || null;
  const userTeam = location.state?.userTeam || null;
  console.log("User Role:", userRole);
  console.log("User Team:", userTeam);
  const navigate = useNavigate();
  const [teams, setTeam] = useState([]);
  const [formInputs, setFormInputs] = useState({ name: "", coach: "", photoURL: "", coachURL: "", }); 
  
  const [isLoading, setIsLoading] = useState(true); 

  const [deleteT, setdeleteTeam] = useState(false); 
  const [teamToDelete, setTeamToDelete] = useState(null); 
  const deleteTeam = () => { setdeleteTeam(prev => !prev); }
  const [editingTeam, setEditingTeam] = useState(null); // player object currently being edited 

    const handleDelete = async () => {
      try { 
        if (!teamToDelete) return;

        await deleteTeamApi(teamToDelete.teamID ?? teamToDelete.id);
        setTeam(prevTeam => prevTeam.filter(p => p.id !== teamToDelete.id)); 
        console.log("Team removed successfully!"); 
        setdeleteTeam(false); 
      } catch (error) { 
        console.error("Error deleting team:", error); 
      } 
    }; 
            
      const handleCancel = () => {
        setTeamToDelete(null);
        setdeleteTeam(false);
      };
  
      const [add, setAdd] = useState(false); 
  
      const startAdd = () => { 
        setAdd(prev => !prev); 
      }
  
          const handleAdd = async (info) => {
              try {
                  const payload = {
                    name: info.name,
                    coach: info.coachName,
                    coachURL: info.coachURL || coach_placeholder,
                    photoURL: info.photoURL || teamPhoto,
                  };

                  const created = await createTeam(payload);
  
                  // update local state immediately
                  setTeam((prevTeam) => [
                      ...prevTeam,
                      {
                        id: created.id,
                        teamID: created.teamID,
                        name: created.name,
                        coach: created.coach,
                        coachURL: created.coachURL || coach_placeholder,
                        photoURL: created.photoURL || teamPhoto,
                      },
                  ]);
  
              } catch (error) {
                  console.error("Error adding team:", error);
              }
          };
              
          const editTeam = async (teamID, updatedInfo) => { 
              await updateTeam(teamID, updatedInfo); 
          } 
          
          const [edit, setEdit] = useState(false); 
          const changeEdit = () => { setEdit(prev => !prev); }  
  
      const handleLogout = () => {
        navigate("/login");
      };

    useEffect(() => {
      const fetchTeams = async () => {
        setIsLoading(true);
        try {
          const teamList = await getTeams();
          const normalized = teamList.map(team => ({
            ...team,
            // Skip expensive per-team counts
            noPlayers: null
          }));
          setTeam(normalized);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchTeams();
    }, []);
    console.log("Edit: ", edit);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", width: "100vw", overflowX: "hidden" }}>
      <Header
        title="🏟️ Manage Teams"
        subtitle="Manage teams, coaches, and squad context."
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

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
                        <h2 style={{ color: "#FF681F" }}>Add Team</h2>
                    
                    <input 
                        type="text" 
                        placeholder="Name"
                        value={formInputs.name}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, name: e.target.value})}
                    />

                    <input 
                        type="text" 
                        placeholder="Team Photo URL"
                        value={formInputs.photoURL}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, photoURL: e.target.value})}
                    />

                    <input 
                        type="text" 
                        placeholder="Coach"
                        value={formInputs.coach}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, coach: e.target.value})}
                    />
                    <input 
                        type="text" 
                        placeholder="Coach Photo URL"
                        value={formInputs.coachURL}
                        style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                        onChange={(e) => setFormInputs({...formInputs, coachURL: e.target.value})}
                    />

                    <button onClick={() => {
                        setAdd(false);
                        setFormInputs({ name: "", position: "", photoURL: "", birthdate: "" });}}>
                        Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!formInputs.name || !formInputs.coach) {
                          alert("Please fill in both Team Name and Coach Name");
                          return;
                        }

                        await handleAdd({
                          name: formInputs.name,
                          coachName: formInputs.coach,
                          photoURL: formInputs.photoURL,
                          coachURL: formInputs.coachURL
                        });

                        setAdd(false);
                        setFormInputs({ name: "", coach: "", photoURL: "", coachURL: "" });
                      }}
                    >
                      Add
                    </button>
                    </div>
        </div>)
      }

      {deleteT && (
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
                        <p style={{color:"#000"}}>Are you sure you want to delete this team?</p>
                        <button onClick={handleCancel} style={{backgroundColor:"#000"}}>Cancel</button>
                        <button onClick={handleDelete} style={{backgroundColor:"red"}}>Delete</button>
                    </div>
        </div>)
      }

      {editingTeam && (
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
                          <h2 style={{ color: "#FF681F" }}>Edit Team</h2>
                          
                          <input 
                              type="text" 
                              placeholder="Name"
                              value={formInputs.name}
                              style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                              onChange={(e) => setFormInputs({...formInputs, name: e.target.value})}
                          />
      
                          <input 
                              type="text" 
                              placeholder="Team Photo URL"
                              value={formInputs.photoURL}
                              style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                              onChange={(e) => setFormInputs({...formInputs, photoURL: e.target.value})}
                          />
                          <input 
                              type="text" 
                              placeholder="Coach"
                              value={formInputs.coach}
                              style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                              onChange={(e) => setFormInputs({...formInputs, coach: e.target.value})}
                          />
                          <input 
                              type="text" 
                              placeholder="Coach Photo URL"
                              value={formInputs.coachURL}
                              style={{height:"4vh", borderRadius:8, color:"#000", backgroundColor:"#fff", borderColor:"#FF681F", paddingLeft:10}}
                              onChange={(e) => setFormInputs({...formInputs, coachURL: e.target.value})}
                          />
      
                         <button
                          onClick={async () => {
                            const updatedData = {
                              ...editingTeam,
                              ...Object.fromEntries(
                                Object.entries(formInputs).filter(([key, value]) => value !== "")
                              )
                            };

                            await editTeam(editingTeam.id, updatedData);

                            // close form before refresh
                            setEditingTeam(null);
                            changeEdit();
                            
                            setFormInputs({ name: "", photoURL: "", coach: "", coachURL: "" });

                            // refresh full team list
                            const teamList = await getTeams();
                            setTeam(teamList.map(team => ({ ...team })));
                          }}
                        >
                          Save
                        </button>

      
                          </div>
                      </div>
                  )}

      {/* Content */}
      <div style={{ display: "grid", padding: "5vh 6vw", boxSizing:"border-box", justifyContent:"center"}}>
        {isLoading ? (
          <Spinner />
        ) : teams.length === 0 ? (
          <p style={{ color: "#555", textAlign: "center", width: "100%" }}>
            No teams found.
          </p>
        ) : (
          <div>
          {userRole === "admin" ? (
            <div style={{ display: "flex", justifyContent: "start", marginBottom: "2vh", gap: "1vw" }}>
              <button onClick={changeEdit}>Edit</button>
              <button onClick={setAdd}>Add</button>
            </div>) : (null)
          }

          {teams.map((team) => (
            <div
              key={team.teamID}
              onClick={() => navigate(`/team-players`, { state: { teamID: team.teamID, teamName: team.name, teamCoach: team.coach, role: userRole, userTeam: userTeam } })}
              style={teamCardStyle}
            >
              <div style={teamCardTopRow}>
                <div style={teamLogoStack}>
                  <div style={logoBadge}>
                    <img
                      src={team.photoURL || "/placeholder.png"}
                      alt={`${team.name} badge`}
                      style={teamLogoStyle}
                    />
                  </div>
                </div>
                <div style={teamTitleGroup}>
                  <p style={teamLabel}>Team</p>
                  <h2 style={teamName}>{team.name}</h2>
                </div>
              </div>

              <div style={trainerRow}>
                <div>
                  <p style={teamLabel}>Coach</p>
                  <p style={coachName}>{team.coach || "—"}</p>
                </div>
                <div style={coachAvatarWrap}>
                  <img
                    src={team.coachURL || "/coach_placeholder.png"}
                    alt={`${team.coach} portrait`}
                    style={coachAvatarStyle}
                  />
                </div>
              </div>

              {edit && (
                <div style={adminButtonRow}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTeam(team);
                      setFormInputs({ name: team.name, photoURL: team.photoURL, coach: team.coach, coachURL: team.coachURL });
                    }}
                    style={outlineButton}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTeamToDelete(team);
                      deleteTeam();
                    }}
                    style={deleteButton}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  )
};

const teamCardStyle = {
  backgroundColor: "#fff",
  borderRadius: 18,
  paddingLeft: "3vw",
  paddingRight: "3vw",
  paddingBottom: "1.5vw",
  paddingTop: "3vw",
  marginBottom: "12px",
  width: "78vw",
  maxWidth: "340px",
  border: "1px solid rgba(255,104,31,0.25)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
  display: "flex",
  flexDirection: "column",
  gap: "0.9vh",
  cursor: "pointer",
  alignSelf: "center",
  position: "relative",
  overflow: "visible",
};

const teamCardTopRow = {
  display: "flex",
  alignItems: "center",
  gap: "2vw",
  marginTop: "1.5vh",
};

const teamLogoStack = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "-2.5vh",
};

const logoBadge = {
  width: "10vh",
  height: "10vh",
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.4)",
  padding: "4px",
  background: "linear-gradient(135deg, #fff0e6, #fff)",
  boxShadow: "0 10px 18px rgba(255,104,31,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const teamLogoStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
};

const teamTitleGroup = {
  display: "flex",
  flexDirection: "column",
  gap: "1vw",
  marginLerft: "1vw",
  marginTop: "-4vh",
};

const teamLabel = {
  margin: 0,
  fontSize: "0.8rem",
  color: "#FF681F",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const teamName = {
  margin: 0,
  fontSize: "1.5rem",
  color: "#222",
  whitespace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const trainerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: "-2vh",
  marginLeft: "2vw",
};

const coachName = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 600,
  color: "#444",
};

const coachAvatarWrap = {
  width: "8vh",
  height: "8vh",
  marginRight: "4vw",
  borderRadius: "50%",
  border: "3px solid #FF681F",
  overflow: "hidden",
  boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
};

const coachAvatarStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const adminButtonRow = {
  display: "flex",
  gap: "1vw",
  marginTop: "2vh",
};

const outlineButton = {
  flex: 1,
  padding: "8px 0",
  borderRadius: 12,
  border: "1px solid #FF681F",
  backgroundColor: "transparent",
  color: "#FF681F",
  fontWeight: 600,
};

const deleteButton = {
  flex: 1,
  padding: "8px 0",
  borderRadius: 12,
  border: "none",
  backgroundColor: "#FF5252",
  color: "#fff",
  fontWeight: 600,
};

export default TeamsPage;
