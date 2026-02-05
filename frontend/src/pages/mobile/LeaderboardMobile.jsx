import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LeaderboardMobile.css";
import profilePhoto from "../../assets/download.jpeg";
import { getLeaderboard } from "../../api/stats.js";

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
        const res = await getLeaderboard({ stat: activeStat, limit: 12 });
        if (cancelled) return;
        const players = Array.isArray(res?.players) ? res.players : [];
        setLeaders(players);
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
  const statLabelText = activeStatLabel.toLowerCase();

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
          {activeStatLabel} - {metricSuffix}
        </p>
      </div>

      {loading ? (
        <p className="leaderboard-mobile-loading">Loading leaderboards...</p>
      ) : (
        <div className="leaderboard-mobile-list">
          {sortedLeaders.map((player, index) => {
            const statValue = computeStatValue(player, activeStat, valueType);
            const statDisplay =
              valueType === "per90" ? statValue.toFixed(1) : statValue.toFixed(0);
            const photoSrc = player.photo || player.photoURL || player.profilePhoto || profilePhoto;
            return (
              <article key={player.playerID || player.id} className="leaderboard-mobile-card">
                <div className="leaderboard-mobile-card-main">
                  <img
                    src={photoSrc}
                    alt={player.name}
                    className="leaderboard-mobile-card-photo"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = profilePhoto;
                    }}
                  />
                  <div className="leaderboard-mobile-card-meta">
                    <strong>
                      #{index + 1} {player.name}
                    </strong>
                    <span className="leaderboard-mobile-team">{player.team}</span>
                  </div>
                  <div className="leaderboard-mobile-stat-field">
                    <span className="leaderboard-mobile-stat-value">
                      {statDisplay}
                      {valueType === "per90" && (
                        <span className="leaderboard-mobile-stat-suffix"> / 90</span>
                      )}
                    </span>
                    <span className="leaderboard-mobile-stat-label">{statLabelText}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

