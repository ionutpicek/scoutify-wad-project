/* eslint-disable no-unused-vars */
import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeams, createTeam, updateTeam, deleteTeam as deleteTeamApi } from "../api/teams.js";
import { useLocation } from 'react-router-dom';
import Spinner from '../components/Spinner.jsx';
import Header from '../components/Header.jsx';
import teamPhoto from '../assets/superligaF.png';
import coach_placeholder from '../assets/download.jpeg';

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

    const handleDelete = async () => { try { 
      if (!teamToDelete) return;
    
        await deleteTeamApi(teamToDelete.teamID);
     
        setTeam(prevTeam => prevTeam.filter(p => p.id !== teamToDelete.id)); 
        console.log("Team removed successfully!"); setdeleteTeam(false); 
      } catch (error) { console.error("Error deleting team:", error); } }; 
            
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
                  const created = await createTeam({
                      name: info.name,
                      coach: info.coachName,
                      coachURL: info.coachURL || coach_placeholder,
                      photoURL: info.photoURL || teamPhoto,
                  });

                  setTeam((prevTeam) => [...prevTeam, created]);
  
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
          setTeam(teamList.map(team => ({ ...team, noPlayers: null })));
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

                            await editTeam(editingTeam.teamID, updatedData);

                            // close form before refresh
                            setEditingTeam(null);
                            changeEdit();
                            
                            setFormInputs({ name: "", photoURL: "", coach: "", coachURL: "" });

                            // refresh full team list, not individual one
                            const teamList = await getTeams();
                            setTeam(teamList);
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
              style={{
                backgroundColor: "#fff",
                border: "1px solid #FF681F",
                borderRadius: 12,
                padding: "1vw",
                marginBottom: "2vh",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                width: "80vw",
                height: "24vh",
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-around",
              }}
            >
              <div style={{justifyContent:"center", alignContent:"center"}}>
                <img
                src={team.photoURL || "/placeholder.png"}
                style={{
                    width: "20vh",
                    height: "20vh",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #FF681F",
                    justifyContent:"center", alignContent:"center"
                  }}
                />
              </div>

              <div style={{justifyContent:"center", alignContent:"center", textAlign:"center"}}>
                <h2 style={{ margin: "0 0 10px 0", color:"#ff681f"}}>{team.name}</h2>
                <h2 style={{ margin: "0 0 10px 0", color:"#000"}}>Coach: {team.coach}</h2>
              </div>

              <div style={{justifyContent:"center", alignContent:"center"}}>
                <img
                  src={team.coachURL || "/coach_placeholder.png"}
                  style={{
                    width: "20vh",
                    height: "20vh",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #FF681F",
                  }}
                />
              </div>

              {edit && (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "1vh" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTeam(team);
                      setFormInputs({ name: team.name, photoURL: team.photoURL, coach: team.coach, coachURL: team.coachURL });
                    }}
                  >
                    Edit  
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTeamToDelete(team);
                      deleteTeam();
                    }}
                  >Delete
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

export default TeamsPage;
