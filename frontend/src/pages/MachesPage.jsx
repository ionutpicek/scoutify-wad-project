import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { getAllMatches, uploadMatchPdf } from "../api/matches.js";

export default function MatchesPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [metricsFile, setMetricsFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [teamFilter, setTeamFilter] = useState("");
  const [roundFilter, setRoundFilter] = useState("");
  const pageSize = 6;

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const data = await getAllMatches();
      setMatches(data);
      setPage(0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    // reset pagination when filters change
    setPage(0);
  }, [teamFilter, roundFilter]);

  const uniqueTeams = React.useMemo(() => {
    const set = new Set();
    matches.forEach(m => {
      if (m.homeTeam) set.add(m.homeTeam);
      if (m.awayTeam) set.add(m.awayTeam);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const uniqueRounds = React.useMemo(() => {
    const set = new Set();
    matches.forEach(m => {
      if (m.round != null) set.add(m.round);
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [matches]);

  const filteredMatches = React.useMemo(() => {
    return matches.filter(m => {
      const teamHit =
        !teamFilter ||
        [m.homeTeam, m.awayTeam]
          .filter(Boolean)
          .some(t => t.toLowerCase().includes(teamFilter.toLowerCase()));
      const roundHit =
        !roundFilter ||
        (m.round != null && String(m.round) === String(roundFilter));
      return teamHit && roundHit;
    });
  }, [matches, teamFilter, roundFilter]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadMatchPdf(file, metricsFile);
      setFile(null);
      setMetricsFile(null);
      await fetchMatches(); // refresh list
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#fff", minHeight: "100vh", width:"100vw" }}>
      <Header
        title="⚽ Analyze Matches"
        subtitle="Upload match PDFs and review game performance."
        onBack={() => navigate(-1)}
        onLogout={() => navigate("/login")}
      />

      <div style={{ padding: "3vh 4vw", display: "flex", flexDirection: "column"}}>
        {/* Upload section */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #ffd2b3",
            borderRadius: 14,
            padding: 14,
            marginBottom: "2vh",
            boxShadow: "0 8px 22px rgba(255,104,31,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ color: "#FF681F", fontWeight: 700, fontSize: 18 }}>
              Upload Match PDF
            </div>

            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                type="button"
                onClick={() => document.getElementById("match-upload-input")?.click()}
                style={{
                  background: "#fff",
                  color: "#FF681F",
                  border: "1px solid #FF681F",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Choose file
              </button>
              <input
                id="match-upload-input"
                type="file"
                accept="application/pdf"
                onChange={e => setFile(e.target.files[0])}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                  width: "100%",
                  height: "100%"
                }}
              />
            </div>
            {file && (
              <span style={{ color: "#777", fontSize: 13 }}>
                Selected: {file.name}
              </span>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              marginLeft: 12,
              background: "#FF681F",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              minWidth: 96
            }}
          >
          {uploading ? "Uploading..." : "Submit"}
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "2vw",
            margin: "2vh 0 18px 0",
            alignItems: "center"
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{
                padding: "1vh 1.5vh",
                borderRadius: 8,
                border: "1px solid #FF681F",
                backgroundColor: "#fffffa",
                color: "#000",
                fontSize: 16,
                height: "6vh",
                boxSizing: "border-box",
                minWidth: 200
              }}
            >
              <option value="">All teams</option>
              {uniqueTeams.map(team => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              value={roundFilter}
              onChange={e => setRoundFilter(e.target.value)}
              style={{
                padding: "1vh 1.5vh",
                borderRadius: 8,
                border: "1px solid #FF681F",
                backgroundColor: "#fffffa",
                color: "#000",
                fontSize: 16,
                height: "6vh",
                boxSizing: "border-box",
                minWidth: 140
              }}
            >
              <option value="">All rounds</option>
              {uniqueRounds.map(r => (
                <option key={r} value={r}>
                  Round {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Matches list */}
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              {matches
                .filter(m => filteredMatches.includes(m))
                .slice(page * pageSize, page * pageSize + pageSize)
                .map(match => (
                  <div
                    key={match.id}
                    onClick={() => navigate(`/matches/${match.id}`)}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      height:"12vh",
                      padding: 16,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      borderLeft: "6px solid #FF681F",
                    }}
                  >
                    <h4 style={{ margin: 0, color: "#FF681F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {match.homeTeam} vs {match.awayTeam}
                    </h4>

                    <div style={{display:"flex", flexDirection:"row", justifyContent:"space-around" }}>
                    <p style={{ color: "#555", fontSize:16 }}>
                      {match.round ? `Round ${match.round}` : match.date}
                    </p>

                    {match.score && (
                      <p style={{ fontSize:16, color:"#000" }}>{match.score}</p>
                    )}

                    <p style={{fontSize:16, color: "#777" }}>
                      Players: {match.playersCount ?? 0}
                    </p>
                    </div>
                  </div>
                ))}
            </div>

            {filteredMatches.length > pageSize && (
              <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ padding: "8px 14px" }}
                >
                  Prev
                </button>
                <span style={{ alignSelf: "center", color: "#555" }}>
                  Page {page + 1} / {Math.ceil(filteredMatches.length / pageSize)}
                </span>
                <button
                  onClick={() =>
                    setPage(p =>
                      p + 1 < Math.ceil(filteredMatches.length / pageSize) ? p + 1 : p
                    )
                  }
                  disabled={(page + 1) * pageSize >= filteredMatches.length}
                  style={{ padding: "8px 14px" }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
