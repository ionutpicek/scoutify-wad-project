/* eslint-disable no-unused-vars */
// src/pages/Players.jsx
import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, getDocs } from "firebase/firestore";
import {  app } from "../firebase.jsx"; // your Firebase config file

function TeamsPage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);

  const db = getFirestore(app);

  useEffect(() => {
    const fetchData = async () => {
        // 🔹 Fetch teams
        const teamsSnapshot = await getDocs(collection(db, "team"));
        const teamList = teamsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTeams(teamList);
  };
  fetchData();
  }, [db]);
  
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
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", width: "100vw", overflowX: "hidden" }}>
    {/* Header */}
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
        <span style={{ padding: "0 5vw" }}>Teams</span>
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

      {/* Content */}
      <div style={{ display: "grid", padding: "5vh 6vw", boxSizing:"border-box", justifyContent:"center"}}>
        {teams.map((team) => (
          <div
            key={team.teamID}
            style={{
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
              <h2 style={{ margin: "0 0 10px 0", color:"#ff681f"}}>Coach: {team.coach}</h2>
              <h2 style={{ margin: 0, color:"#000000" }}>{team.noPlayers} players</h2>
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
          </div>
        ))}
      </div>
    </div>
  )
};

export default TeamsPage;
