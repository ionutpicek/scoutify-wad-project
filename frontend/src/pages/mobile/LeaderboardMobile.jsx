import React, { useEffect, useMemo, useState } from "react";
import { collection, orderBy, query, limit, where } from "firebase/firestore";
import { db, getDocsLogged as getDocs } from "../../firebase.jsx";
import { useNavigate } from "react-router-dom";
import "./LeaderboardMobile.css";

const statOptions = [
  { id: "goals", label: "Goals" },
  { id: "assists", label: "Assists" },
  { id: "accuratePasses", label: "S. Passes" },
  { id: "dribblesSuccessful", label: "S. Dribbles" },
  { id: "duelsWon", label: "Duels Won" },
  { id: "saves", label: "Saves" },
];

const valueTypeOptions = [
  { id: "total", label: "Total" },
  { id: "per90", label: "Per 90" },
];

const computeStatValue = (player, statKey, valueType) => {
  const raw = player.stats?.[statKey] ?? 0;
  if (valueType === "per90") {
    const minutes = player.stats?.minutes ?? 0;
    return minutes ? (raw / minutes) * 90 : 0;
  }
  return raw;
};

export default function LeaderboardMobile() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [activeStat, setActiveStat] = useState(statOptions[0].id);
  const [valueType, setValueType] = useState(valueTypeOptions[0].id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const statsSnap = await getDocs(
          query(collection(db, "stats"), orderBy(activeStat, "desc"), limit(12))
        );
        if (cancelled) return;

        const statsList = statsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const playerIds = Array.from(
          new Set(statsList.map((stat) => stat.playerID).filter(Boolean))
        );
        const playerMap = new Map();

        for (let i = 0; i < playerIds.length; i += 10) {
          const chunk = playerIds.slice(i, i + 10);
          if (!chunk.length) break;
          const playersSnap = await getDocs(
            query(collection(db, "player"), where("playerID", "in", chunk))
          );
          playersSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data?.playerID) {
              playerMap.set(data.playerID, { id: doc.id, ...data });
            }
          });
        }

        const enriched = statsList.map((stat) => {
          const player = playerMap.get(stat.playerID);
          return {
            id: stat.id,
            playerID: stat.playerID,
            name: player?.name || player?.playerName || stat.playerName || "Player",
            team: player?.teamName || player?.team || stat.teamName || "Team",
            photo:
              player?.photoURL || player?.photo || player?.profilePhoto || "",
            stats: stat,
            goals: stat.goals ?? 0,
            assists: stat.assists ?? 0,
          };
        });

        setLeaders(enriched);
      } catch (error) {
        console.error("Leaderboard load failed:", error);
        setLeaders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeStat]);

  const sortedLeaders = useMemo(() => {
    return [...leaders].sort((a, b) =>
      computeStatValue(b, activeStat, valueType) - computeStatValue(a, activeStat, valueType)
    );
  }, [leaders, activeStat, valueType]);

  const activeStatLabel =
    statOptions.find((option) => option.id === activeStat)?.label || "Stat";

  const metricSuffix = valueType === "per90" ? "per 90" : "total";

  return (
    <div className="leaderboard-mobile-shell">
      <header className="leaderboard-mobile-header">
        <div>
          <p className="leaderboard-mobile-title">Leaderboards</p>
          <p className="leaderboard-mobile-subtitle">Top performers across the league.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="leaderboard-mobile-back"
        >
          Back
        </button>
      </header>

      <div className="leaderboard-mobile-filters">
        <div className="leaderboard-mobile-stat-buttons">
          {statOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`leaderboard-mobile-stat-button${
                activeStat === option.id ? " leaderboard-mobile-stat-button-active" : ""
              }`}
              onClick={() => setActiveStat(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="leaderboard-mobile-value-toggle">
          {valueTypeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`leaderboard-mobile-toggle${
                valueType === option.id ? " leaderboard-mobile-toggle-active" : ""
              }`}
              onClick={() => setValueType(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="leaderboard-mobile-metric-label">
          {activeStatLabel} · {metricSuffix}
        </p>
      </div>

      {loading ? (
        <p className="leaderboard-mobile-loading">Loading leaderboards�...</p>
      ) : (
        <div className="leaderboard-mobile-list">
          {sortedLeaders.map((player, index) => (
            <article key={player.playerID || player.id} className="leaderboard-mobile-card">
              <div className="leaderboard-mobile-row">
                
                <strong>
                  #{index + 1} {player.name}
                </strong>
                <span className="leaderboard-mobile-goals">
                  {computeStatValue(player, activeStat, valueType).toFixed(valueType === "per90" ? 1 : 0)}
                </span>
              </div>
              <div className="leaderboard-mobile-row">
                <span>{player.team}</span>
                <span>{player.assists} assists</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
