import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { db, getDocsLogged as getDocs } from "../firebase.jsx";

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

const computeStatValue = (player, stat, valueType) => {
  const raw = player.stats?.[stat] ?? 0;
  if (valueType === "per90") {
    const minutes = player.stats?.minutes ?? 0;
    return minutes ? (raw / minutes) * 90 : 0;
  }
  return raw;
};

const podiumSlots = [
  { rank: 2, index: 1, height: 190 },
  { rank: 1, index: 0, height: 255 },
  { rank: 3, index: 2, height: 170 },
];

const Leaderboard = () => {
  const navigate = useNavigate();
  const handleLogout = () => navigate("/login");

  const [activeStat, setActiveStat] = useState(statOptions[0].id);
  const [valueType, setValueType] = useState(valueTypeOptions[0].id);
  const [playerRows, setPlayerRows] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  useEffect(() => {
    const loadPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const statsQuery = query(
          collection(db, "stats"),
          orderBy(activeStat, "desc"),
          limit(10)
        );

        const statsSnapshot = await getDocs(statsQuery);
        const playerIds = statsSnapshot.docs
          .map((d) => d.data()?.playerID)
          .filter(Boolean);

        const playerMap = new Map();

        for (let i = 0; i < playerIds.length; i += 10) {
          const chunk = playerIds.slice(i, i + 10);
          if (!chunk.length) continue;
          const playersQuery = query(
            collection(db, "player"),
            where("playerID", "in", chunk)
          );
          const playersSnapshot = await getDocs(playersQuery);

          playersSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const key = data.playerID ?? docSnap.id;
            playerMap.set(key, { id: docSnap.id, ...data });
          });
        }

        const enrichedPlayers = statsSnapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const key = data.playerID ?? docSnap.id;
          const playerDoc = playerMap.get(key);

          return {
            id: playerDoc?.id ?? key,
            name: playerDoc?.name || "Unknown",
            team: playerDoc?.teamName || playerDoc?.team || "Unknown",
            // ✅ photo support (safe fallbacks — change keys if your DB uses different names)
            photo:
              playerDoc?.photo ||
              playerDoc?.photoURL ||
              playerDoc?.imageUrl ||
              playerDoc?.profilePhoto ||
              "",
            stats: data,
          };
        });

        setPlayerRows(enrichedPlayers);
      } catch (error) {
        console.error("Failed to load leaderboard", error);
        setPlayerRows([]);
      } finally {
        setLoadingPlayers(false);
      }
    };

    loadPlayers();
  }, [activeStat]);

  const sortedPlayers = useMemo(() => {
    return [...playerRows].sort((a, b) => {
      return (
        computeStatValue(b, activeStat, valueType) -
        computeStatValue(a, activeStat, valueType)
      );
    });
  }, [playerRows, activeStat, valueType]);

  const primaryMetricLabel =
    statOptions.find((o) => o.id === activeStat)?.label ?? "";

  const renderPlayerRows = () => {
    if (loadingPlayers) {
      return (
        <div style={loadingContainer}>
          <Spinner />
        </div>
      );
    }

    if (!sortedPlayers.length) {
      return <p style={emptyMessage}>No player stats have been synced yet.</p>;
    }


    return sortedPlayers.map((player, index) => {
      const displayValue = computeStatValue(player, activeStat, valueType);
      const formatted =
        valueType === "per90"
          ? displayValue.toFixed(1)
          : Math.round(displayValue);


      return (
        <div
          key={player.id}
          style={{
            ...playerRow,
            borderBottom:
              index === sortedPlayers.length - 1 ? "none" : playerRow.borderBottom,
          }}
        >
          <div style={rankCircle}>{index + 1}</div>

          <div style={playerMain}>
            <div style={avatarWrap}>
              {player.photo ? (
                <img src={player.photo} alt={player.name} style={avatarImg} />
              ) : (
                <div style={avatarFallback}>{player.name?.[0] || "?"}</div>
              )}
            </div>

            <div style={playerInfo}>
              <p style={playerName}>{player.name}</p>
              <p style={playerTeam}>{player.team}</p>
            </div>
          </div>

          <div style={playerStat}>
            <p style={statValue}>{formatted}</p>
            <p style={statLabel}>
              {primaryMetricLabel} · {valueType === "per90" ? "per 90" : "total"}
            </p>
          </div>
        </div>
      );
    });
  };

  return (
    <div style={pageWrapper}>
      <Header
        title="Leaderboard"
        subtitle="Spot the top performers"
        onBack={() => navigate(-1)}
        onLogout={handleLogout}
      />

      <div style={pageContent}>
        <div style={filtersRow}>
          <div style={statButtonGroup}>
            {statOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveStat(option.id)}
                style={statButton(activeStat === option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={valueToggleWrapper}>
            {valueTypeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setValueType(option.id)}
                style={valueToggle(valueType === option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={contentGrid}>
          <div style={playerList}>{renderPlayerRows()}</div>

          <div style={podiumWrapper}>
            <div style={podiumHeaderRow}>
              <p style={podiumTitle}>🏆 Podium</p>
              <p style={podiumSubtitle}>
                {primaryMetricLabel} · {valueType === "per90" ? "per 90" : "total"}
              </p>
            </div>

            {/* decorative stars */}
            <div style={podiumStars} aria-hidden="true">
              {/* top edge */}
              <span style={{ ...star, top: 78, left: 70 }}>✨</span>
              <span style={{ ...star, top: 108, left: 40 }}>⭐</span>
              <span style={{ ...star, top: 60, left: 26 }}>✦</span>
              <span style={{ ...star, top: 90, right: 90 }}>✨</span>
              <span style={{ ...star, top: 110, right: 46 }}>✦</span>
              <span style={{ ...star, top: 128, right: 60 }}>⭐</span>

              {/* left edge 
              <span style={{ ...star, top: 120, left: 60 }}>⭐</span>
              <span style={{ ...star, bottom: 140, left: 16 }}>✦</span>
              <span style={{ ...star, top: 160, left: 40 }}>⭐</span>
              <span style={{ ...star, bottom: 200, left: 36 }}>✦</span>
               <span style={{ ...star, top: 18, left: 150 }}>⭐</span>
              <span style={{ ...star, top: 10, left: 16 }}>✨</span>*/}

              {/* right edge 
              <span style={{ ...star, top: 140, right: 12 }}>⭐</span>
              <span style={{ ...star, bottom: 120, right: 18 }}>✨</span>
              <span style={{ ...star, top: 160, right: 40 }}>⭐</span>
              <span style={{ ...star, bottom: 200, right: 36 }}>✦</span>
               <span style={{ ...star, top: 18, right: 150 }}>⭐</span>
              <span style={{ ...star, top: 10, right: 16 }}>✨</span>*/}

              {/* bottom edge 
              <span style={{ ...star, bottom: 14, left: 60 }}>✦</span>
              <span style={{ ...star, bottom: 18, right: 64 }}>⭐</span>
              <span style={{ ...star, bottom: 160, left: 40 }}>⭐</span>
              <span style={{ ...star, bottom: 200, left: 36 }}>✦</span>
               <span style={{ ...star, bottom: 18, left: 150 }}>⭐</span>
              <span style={{ ...star, bottom: 10, right: 16 }}>✨</span>*/}
            </div>

            <div style={podiumContent}>
              <div style={podiumStack}>
                {podiumSlots.map((slot) => {
                  const player = sortedPlayers[slot.index];
                  const displayValue = player ? computeStatValue(player, activeStat, valueType) : 0;
                  const formatted = player
                    ? valueType === "per90"
                      ? displayValue.toFixed(1)
                      : Math.round(displayValue)
                    : "--";

                  const theme =
                    slot.rank === 1 ? podiumGold : slot.rank === 2 ? podiumSilver : podiumBronze;

                  return (
                    <div
                      key={`podium-${slot.rank}`}
                      style={{
                        ...podiumStep,
                        ...theme,
                        height: slot.height,
                        paddingTop: slot.rank === 1 ? 30 : 14, // extra space for crown
                        opacity: player ? 1 : 0.5,
                      }}
                    >
                      {/* crown for #1 */}
                      {slot.rank === 1 ? <div style={crown}>👑</div> : null}

                      <div style={podiumTop}>
                        <div style={podiumAvatarWrap}>
                          {player?.photo ? (
                            <img src={player.photo} alt={player.name} style={podiumAvatarImg} />
                          ) : (
                            <div style={podiumAvatarFallback}>{player?.name?.[0] || "?"}</div>
                          )}
                        </div>

                        <div style={podiumBadge}>{slot.rank}</div>

                        <p style={podiumName}>{player ? player.name : "Awaiting data"}</p>
                      </div>

                      <div style={podiumBottom}>
                        <p style={podiumMetric}>
                          <span style={{ fontWeight: 900 }}>{formatted}</span>{" "}
                          <span style={{ color: "#6B7280", fontWeight: 800 }}>
                            {valueType === "per90" ? "per 90" : "total"}
                          </span>
                        </p>

                        <p style={podiumTeam}>{player ? player.team : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

        </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------- styles -------------------- */

const pageWrapper = {
  height: "100vh",
  width: "100vw",
  background: "#fffaf8",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const pageContent = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const filtersRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "1.5vh 5vw 2vh",
  flex: 0,
};

const statButtonGroup = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statButton = (active) => ({
  borderRadius: 999,
  padding: "10px 20px",
  border: active ? "1px solid #FF681F" : "1px solid #ddd",
  background: active ? "#fff6ee" : "#fff",
  color: "#111",
  fontWeight: 800,
  cursor: "pointer",
});

const valueToggleWrapper = {
  display: "flex",
  gap: 6,
  background: "#fff",
  borderRadius: 12,
  padding: 4,
  border: "1px solid #eee",
};

const valueToggle = (active) => ({
  border: "none",
  background: active ? "#FF681F" : "transparent",
  color: active ? "#fff" : "#333",
  borderRadius: 8,
  padding: "8px 16px",
  fontWeight: 800,
  cursor: "pointer",
});

const contentGrid = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.75fr",
  alignItems: "stretch",      
  gap: "2vh",
  padding: "0 5vw 4vh",
  overflow: "hidden",
  flex: 1,
};


const playerList = {
  background: "#fff",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  height: "92%",
  overflowY: "auto",
};

const playerRow = {
  display: "grid",
  gridTemplateColumns: "56px 1fr 140px",
  alignItems: "center",
  padding: "12px 10px",
  borderBottom: "1px solid #f0f0f0",
};

const rankCircle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "#FF681F",
  color: "#fff",
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
  justifySelf: "center",
  boxShadow: "0 12px 20px rgba(0,0,0,0.10)",
};

const playerMain = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const avatarWrap = {
  width: 44,
  height: 44,
  borderRadius: 14,
  overflow: "hidden",
  background: "#FFF2E8",
  border: "1px solid rgba(255,104,31,0.25)",
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
};

const avatarImg = { width: "100%", height: "100%", objectFit: "cover" };

const avatarFallback = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  color: "#FF681F",
};

const playerInfo = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};

const playerName = {
  margin: 0,
  fontWeight: 900,
  color: "#111",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const playerTeam = {
  margin: 0,
  color: "#6B7280",
  fontSize: 13,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const playerStat = { textAlign: "right" };

const statValue = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#111",
};

const statLabel = {
  margin: 0,
  color: "#9CA3AF",
  fontSize: 12,
  fontWeight: 700,
};

const loadingContainer = {
  display: "grid",
  placeItems: "center",
  minHeight: 180,
};

const emptyMessage = {
  margin: "2rem auto",
  textAlign: "center",
  color: "#666",
  fontWeight: 700,
};

/* Podium */

const podiumWrapper = {
  position: "relative",
  background: "#fff",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  overflow: "hidden",
  height: "90%",
};

const podiumContent = {
  position: "relative",
  zIndex: 2,                // ✅ content above stars
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const podiumTop = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  flex: 1,
  justifyContent: "flex-start",
};

const podiumBottom = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  marginTop: "auto",     // ✅ pins bottom area aligned across all
  paddingTop: 8,
};

const podiumHeaderRow = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
};

const podiumTitle = { margin: 0, fontWeight: 900, color: "#FF681F", fontSize: 18 };

const podiumSubtitle = { margin: 0, color: "#6B7280", fontWeight: 800, fontSize: 12 };

const podiumStars = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  opacity: 0.85,
};

const star = {
  position: "absolute",
  fontSize: 16,
  filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.12))",
};

const podiumStack = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  paddingTop: 8,
};

const podiumStep = {
  flex: 1,
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 18px 34px rgba(0,0,0,0.10)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
};


const podiumGold = {
  background: "linear-gradient(180deg, rgba(255,104,31,0.22), rgba(255,104,31,0.06))",
  border: "1px solid rgba(255,104,31,0.35)",
};

const podiumSilver = {
  background: "linear-gradient(180deg, rgba(255,104,31,0.16), rgba(255,104,31,0.05))",
  border: "1px solid rgba(255,104,31,0.25)",
};

const podiumBronze = {
  background: "linear-gradient(180deg, rgba(255,104,31,0.12), rgba(255,104,31,0.04))",
  border: "1px solid rgba(255,104,31,0.20)",
};

const podiumAvatarWrap = {
  width: 74,
  height: 74,
  borderRadius: 22,
  overflow: "hidden",
  background: "#FFF2E8",
  border: "1px solid rgba(255,104,31,0.28)",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 14px 22px rgba(0,0,0,0.10)",
};

const podiumAvatarImg = { width: "100%", height: "100%", objectFit: "cover" };

const podiumAvatarFallback = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  fontSize: 22,
  color: "#FF681F",
};

const podiumBadge = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 28,
  height: 28,
  borderRadius: 10,
  background: "#FF681F",
  color: "white",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  boxShadow: "0 10px 16px rgba(0,0,0,0.12)",
};

const crown = {
  position: "absolute",
  top: 0,          // ✅ more space
  fontSize: 22,
  filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.14))",
};

const podiumName = {
  margin: 0,
  fontWeight: 900,
  color: "#111",
  textAlign: "center",
  lineHeight: 1.1,
};

const podiumMetric = { margin: 0, fontSize: 14, color: "#111" };

const podiumTeam = {
  display: "flex",
  margin: 0,
  color: "#6B7280",
  fontSize: 12,
  textAlign: "center",
  justifyContent:"end"
};

export default Leaderboard;