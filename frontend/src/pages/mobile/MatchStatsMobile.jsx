/* eslint-disable no-unused-vars */
import React from "react"
import {  useNavigate } from "react-router-dom"
import Header from "../../components/Header.jsx"
import matchStatsProccessing from "../../services/readMatchStats.jsx"

const MatchStats = () => {
    const navigate = useNavigate();
    const handleLogout = () => { navigate("/login"); }; 

    const handleChange = () => {
    };

    const [fileStatus, setFileStatus] = React.useState(false);
    const [file, setFile] = React.useState(null);

    const handleFileChange = (e) => {
        const uploadedFile = e.target.files[0];
        setFile(uploadedFile);
        setFileStatus(!!uploadedFile);
    };

    const handleSubmit = () => {
        if (!file) return;
        matchStatsProccessing(file); // You already import this
        };

    const [inputs, setInputs] = React.useState({
            opponentName: '',
            teamName: '',
            gameDate: '',
            file: '',
        });

    const inputStyle = {
        padding: '12px 15px',
        width: 280,
        borderRadius: 8,
        border: '1px solid #FF681F',
        backgroundColor: '#fffffa',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        fontSize: 16,
        outline: 'none',
        transition: 'all 0.2s ease-in-out',
        color: '#000000',
    };
    
    return (
        <div style={{height:"100vh", width:"100vw", backgroundColor:"#fff", display:"flex", flexDirection:"column"}}>
            <Header
                title="Add Match Stats"
                onBack={() => navigate(-1)}
                onLogout={handleLogout}
            />

            <div style={{flex: 1, display: "flex", justifyContent: "center", alignItems: "center"}}>
                <div style={{
                    width: "70vw",
                    height: "60vh",
                    borderRadius: "16px",
                    border: "1px solid #FF681F",
                    display: "flex",
                    boxShadow:"4px 4px 12px rgba(0,0,0,0.1)",
                    flexDirection:"column",
                    gap:10
                }}>
                    <p style={{color:"#000", fontSize:24, marginLeft:"5vw"}}>
                        Match Stats
                    </p>

                    <div style={{marginLeft: "5vw", gap:10, display:"flex", flexDirection:"column"}}>
                        <input
                            key={inputs.name}
                            name={inputs.name}
                            type={inputs.type}
                            placeholder="Team Name"
                            value={inputs[inputs.teamName]}
                            onChange={handleChange}
                            style={inputStyle}
                        />
                        
                        <input
                            key={inputs.name}
                            name={inputs.name}
                            type={inputs.type}
                            placeholder="Opponent Team"
                            value={inputs.game}
                            onChange={handleChange}
                            style={inputStyle}
                        />

                        <input
                            key={inputs.name}
                            name={inputs.name}
                            type={inputs.type}
                            placeholder="Date"
                            value={inputs.gameDate}
                            onChange={handleChange}
                            style={inputStyle}
                        />  

                        <input
                            id="fileInput"
                            type="file"
                            accept=".xml"
                            value={inputs.file}
                            onChange={handleFileChange}
                            style={{ display: "none" }}   // HIDE INPUT
                        />

                        <div
                            onClick={() => document.getElementById("fileInput").click()}
                            style={{
                                backgroundColor: fileStatus ? "#FF681F" : "#000", // green if file uploaded
                                borderRadius: "4px",
                                width: "8vw",
                                height: "6vh",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                cursor: "pointer",
                                gap:10
                            }}
                            >
                                <p style={{ color: "#fff", fontSize: 20, margin: 0 }}>
                                    {fileStatus ? "File Selected" : "Upload File"}
                                </p>
                        </div>

                    </div>

                    <div style={{borderRadius:"4px", gap:10,
                        alignContent:"center", display:"flex", justifyContent:"center", flexDirection:"column"
                    }}>
                        <button
                            disabled={!fileStatus}
                            onClick={handleSubmit}
                            style={{ alignItems:"center", backgroundColor:"#FF681F", color:"#fff", 
                                marginLeft:"5vw", width:"12vw"}}
                            >
                            Submit
                        </button>
                        
                        {fileStatus ? (
                            <p style={{color:"#000", marginLeft:"5vw"}}>Please provide the xml file first</p>
                        ) : (null)
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MatchStats;