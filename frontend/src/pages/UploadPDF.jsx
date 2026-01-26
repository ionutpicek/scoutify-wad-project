import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import { apiUrl } from "../config/api.js";
import { getCurrentUser } from "../services/sessionStorage.js";

const UploadPDF = () => {
  const navigate = useNavigate();
  const handleLogout = () => navigate("/login");

  const storedUser = useMemo(() => getCurrentUser(), []);
  const canUploadMatches = storedUser?.role !== "player";

  const [fileStatus, setFileStatus] = useState(false);
  const [file, setFile] = useState(null);
  const [inputs, setInputs] = useState({
    matchName: "",
    homeTeam: "",
    awayTeam: "",
    score: "",
    gameDate: "",
  });
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    // Parse filename: "Vasas Femina - Politehnica Timişoara 0-5.pdf"
    const nameWithoutExt = uploadedFile.name.replace(/\.pdf$/i, "");
    const matchParts = nameWithoutExt.split(" - ");
    let homeTeam = "", awayTeam = "", score = "", matchName = nameWithoutExt;

    if (matchParts.length === 2) {
      homeTeam = matchParts[0].trim();
      const secondPart = matchParts[1].trim();
      const scoreMatch = secondPart.match(/(\d+-\d+)$/);
      if (scoreMatch) {
        score = scoreMatch[1];
        awayTeam = secondPart.replace(score, "").trim();
      } else {
        awayTeam = secondPart;
      }
      matchName = `${homeTeam} vs ${awayTeam}`;
    }

    setInputs({ ...inputs, matchName, homeTeam, awayTeam, score });
    setFile(uploadedFile);
    setFileStatus(true);
  };

  const handleSubmit = async () => {
    if (!file || !inputs.gameDate) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("homeTeam", inputs.homeTeam);
      formData.append("awayTeam", inputs.awayTeam);
      formData.append("score", inputs.score);
      formData.append("gameDate", inputs.gameDate);

      // Send PDF to backend for processing
      const res = await fetch(apiUrl("/process-pdf"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to process PDF");

      const result = await res.json();
      alert(`Match processed successfully! AI Grades saved for ${result.players.length} players.`);

      // Reset
      setFile(null);
      setFileStatus(false);
      setInputs({ matchName: "", homeTeam: "", awayTeam: "", score: "", gameDate: "" });
    } catch (error) {
      console.error(error);
      alert("Error processing PDF. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // Compute button color based on fileStatus and gameDate
  const buttonColor = !fileStatus || !inputs.gameDate || loading ? "#999" : "#FF681F";

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
      <Header title="Upload Match Report" onBack={() => navigate(-1)} onLogout={handleLogout} />

      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{
          width: "70vw",
          borderRadius: "16px",
          border: "1px solid #FF681F",
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: "2rem",
          boxShadow: "4px 4px 12px rgba(0,0,0,0.1)",
        }}>
          <p style={{ color: "#000", fontSize: 24 }}>Match Report PDF</p>

          {canUploadMatches ? (
            <>
              <input
                id="pdfInput"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div
                onClick={() => document.getElementById("pdfInput").click()}
                style={{
                  backgroundColor: fileStatus ? "#FF681F" : "#000",
                  borderRadius: "4px",
                  width: "15vw",
                  height: "6vh",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <p style={{ color: "#fff", fontSize: 18, margin: 0 }}>
                  {fileStatus ? "File Selected" : "Upload PDF"}
                </p>
              </div>

              {fileStatus && (
                <div style={{ color: "#000", marginTop: 10 }}>
                  <p><strong>Match Name:</strong> {inputs.matchName}</p>
                  <p><strong>Home Team:</strong> {inputs.homeTeam}</p>
                  <p><strong>Away Team:</strong> {inputs.awayTeam}</p>
                  <p><strong>Score:</strong> {inputs.score}</p>
                  <div style={{display:"flex", flexDirection:"row", gap:10, alignItems:"center"}}>
                    <p><strong>Game Date:</strong></p>
                    <input
                      type="date"
                      value={inputs.gameDate || ""}
                      onChange={(e) => setInputs({ ...inputs, gameDate: e.target.value })}
                      style={{
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid #FF681F",
                        backgroundColor: "#FFF",
                        color: "#000",
                        height:"4vh"
                      }}
                   />
                  </div>
                </div>
              )}

              <button
                disabled={!fileStatus || !inputs.gameDate || loading}
                onClick={handleSubmit}
                style={{
                  backgroundColor: buttonColor,
                  color: "#fff",
                  width: "12vw",
                  height: "6vh",
                  borderRadius: "6px",
                  cursor: !fileStatus || !inputs.gameDate || loading ? "not-allowed" : "pointer",
                  fontSize: 16,
                  marginTop: "1rem",
                }}
              >
                {loading ? "Processing..." : "Submit"}
              </button>
            </>
          ) : (
            <div
              style={{
                padding: "20px",
                borderRadius: 12,
                backgroundColor: "#fff8f0",
                color: "#92400e",
                textAlign: "center",
                border: "1px solid #fcd34d",
                width: "100%",
              }}
            >
              Uploading match PDFs is restricted to managers and admins.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPDF;
