import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, getDocs, query, where, getCountFromServer } from "firebase/firestore";
import { app } from "../firebase.jsx"; // your Firebase config file
import { useLocation } from 'react-router-dom';
import Spinner from '../components/Spinner.jsx';
import Header from '../components/Header.jsx';

const db = getFirestore(app);

function TeamsPage() {
  const location = useLocation();
  const userRole = location.state?.userRole || null;
  const userTeam = location.state?.userTeam || null;
  console.log("User Role:", userRole);
  console.log("User Team:", userTeam);
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  // 🆕 New state for loading status
  const [isLoading, setIsLoading] = useState(true); 

  const handleLogout = () => {
    navigate("/login");
  };

  useEffect(() => {
    const fetchData = async () => {
      // 🚀 Start loading
      setIsLoading(true); 
      
      try {
          // 🔹 Fetch teams
          const teamsSnapshot = await getDocs(collection(db, "team"));
          const teamList = teamsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setTeams(teamList);
      } catch (error) {
        console.error("Error fetching teams:", error);
      } finally {
        // ✅ Stop loading regardless of success or failure
        setIsLoading(false); 
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
  const fetchTeamsWithCounts = async () => {
    setIsLoading(true);
    try {
      const teamsSnapshot = await getDocs(collection(db, "team"));

      const teamList = await Promise.all(
        teamsSnapshot.docs.map(async (doc) => {
          const teamData = { teamID: doc.id, ...doc.data() };

          // Firestore count query
          const q = query(collection(db, "player"), where("teamID", "==", teamData.teamID));
          const snapshot = await getCountFromServer(q);

          return {
            ...teamData,
            noPlayers: snapshot.data().count, // Add count to team
          };
        })
      );

      setTeams(teamList);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  fetchTeamsWithCounts();
}, []);
  

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", width: "100vw", overflowX: "hidden" }}>
      <Header
        title="Teams"
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

      {/* Content */}
      <div style={{ display: "grid", padding: "5vh 6vw", boxSizing:"border-box", justifyContent:"center"}}>
        {isLoading ? (
          // 🆕 Show spinner while loading
          <Spinner />
        ) : teams.length === 0 ? (
          <p style={{ color: "#555", textAlign: "center", width: "100%" }}>
            No teams found.
          </p>
        ) : (
          teams.map((team) => (
            <button
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
            </button>
          ))
        )}
      </div>
    </div>
  )
};

export default TeamsPage;