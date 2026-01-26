import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { apiUrl } from "../config/api.js";
import { db, getDocsLogged as getDocs } from "../firebase.jsx";
import { collection } from "firebase/firestore";
import { findPlayerByNameAndTeam } from "../services/playerServices.jsx";

const VerificationQueue = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: userRole, userTeam, username } = location.state || {};
  const isAdmin = userRole === "admin";

  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [sendingUid, setSendingUid] = useState(null);
  const [linkingUid, setLinkingUid] = useState(null);
  const [manualSelection, setManualSelection] = useState({});
  const [statusMap, setStatusMap] = useState({});

  const refreshQueue = useCallback(async () => {
    if (!isAdmin) return;
    setPendingLoading(true);
    setPendingError("");
    try {
      const res = await fetch(apiUrl("/admin/pending-verifications"));
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to load pending users.");
      }
      const body = await res.json();
      setPendingUsers(body.users || []);
    } catch (err) {
      setPendingError(err.message || "Unable to refresh queue.");
    } finally {
      setPendingLoading(false);
    }
  }, [isAdmin]);

  const loadPlayers = useCallback(async () => {
    if (!isAdmin) return;
    setPlayersLoading(true);
    try {
      const snap = await getDocs(collection(db, "player"));
      const list = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setPlayers(list);
    } catch (err) {
      console.error("Failed to load players:", err);
    } finally {
      setPlayersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const updateStatus = (uid, message) => {
    setStatusMap((prev) => ({ ...prev, [uid]: message }));
  };

  const linkPlayerToUser = async (uid, playerDocId, friendlyName) => {
    const resp = await fetch(apiUrl("/admin/link-player"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, playerDocId }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || "Unable to link player.");
    }
    const payload = await resp.json();
    const linkedName =
      payload?.player?.matchedPlayerName || friendlyName || "player";
    updateStatus(uid, `Linked to ${linkedName}`);
    await refreshQueue();
  };

  const handleApproveUser = async (user) => {
    if (!isAdmin || !user?.uid) return;
    setSendingUid(user.uid);
    updateStatus(user.uid, "Approving account...");
    try {
      const res = await fetch(apiUrl("/admin/verify-user"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to verify user.");
      }
      updateStatus(user.uid, "User approved.");
      await refreshQueue();
    } catch (error) {
      updateStatus(user.uid, error.message || "Unable to approve user.");
    } finally {
      setSendingUid(null);
    }
  };

  const handleAutoLink = async (user) => {
    if (!isAdmin) return;
    setLinkingUid(user.uid);
    updateStatus(user.uid, "Looking for player match...");
    try {
      const resolved = await findPlayerByNameAndTeam({
        fullName: user.fullName,
        teamName: user.teamName,
      });
      if (!resolved) {
        updateStatus(user.uid, "No automatic match found.");
        return;
      }
      await linkPlayerToUser(user.uid, resolved.docId, resolved.name);
    } catch (error) {
      updateStatus(user.uid, error.message || "Auto-link failed.");
    } finally {
      setLinkingUid(null);
    }
  };

  const handleManualSelect = (uid, playerId) => {
    setManualSelection((prev) => ({ ...prev, [uid]: playerId }));
  };

  const handleManualLink = async (user) => {
    if (!isAdmin) return;
    const selectedId = manualSelection[user.uid];
    if (!selectedId) {
      updateStatus(user.uid, "Pick a player before linking.");
      return;
    }
    setLinkingUid(user.uid);
    updateStatus(user.uid, "Linking selected player...");
    const player = players.find((p) => p.id === selectedId);
    try {
      await linkPlayerToUser(user.uid, selectedId, player?.name);
      setManualSelection((prev) => ({ ...prev, [user.uid]: "" }));
    } catch (error) {
      updateStatus(user.uid, error.message || "Manual link failed.");
    } finally {
      setLinkingUid(null);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#fff" }}>
        <Header
          title="Verification queue"
          subtitle="Only admins can access this screen."
          onBack={() => navigate("/dashboard", { state: { role: userRole, userTeam, username } })}
          onLogout={() => navigate("/login")}
        />
        <div
          style={{
            maxWidth: 900,
            margin: "60px auto",
            padding: "20px",
            borderRadius: 16,
            border: "1px solid #F1F5F9",
            textAlign: "center",
            fontSize: 16,
            color: "#475569",
          }}
        >
          Admin access is required to manage pending verifications.
        </div>
      </div>
    );
  }

  const normalizeTeamKey = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const playersForUser = (user) => {
    if (!players.length) return [];
    const teamKey = normalizeTeamKey(user.teamName);
    if (!teamKey) return [];

    const exactMatch = players.filter(
      (player) => normalizeTeamKey(player.teamName) === teamKey
    );
    if (exactMatch.length) return exactMatch;

    return players.filter((player) => {
      const playerTeamKey = normalizeTeamKey(player.teamName);
      return (
        playerTeamKey.includes(teamKey) ||
        teamKey.includes(playerTeamKey)
      );
    });
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff" }}>
      <Header
        title="Verification queue"
        subtitle="Approve new users and link their accounts."
        role={userRole}
        team={userTeam}
        onBack={() => navigate("/dashboard", { state: { role: userRole, userTeam, username } })}
        onLogout={() => navigate("/login")}
      />
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "28px 24px 60px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>New accounts</p>
            <p style={{ margin: "4px 0 0", color: "#475569" }}>
              Review and link every pending user.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={pendingLoading}
              onClick={refreshQueue}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "white",
                padding: "10px 16px",
                cursor: pendingLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {pendingLoading ? "Refreshing..." : "Refresh queue"}
            </button>
            <button
              type="button"
              disabled={playersLoading}
              onClick={loadPlayers}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "white",
                padding: "10px 16px",
                cursor: playersLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {playersLoading ? "Reloading players..." : "Reload players"}
            </button>
          </div>
        </div>

        {pendingError && (
          <div style={{ padding: "12px 14px", borderRadius: 12, backgroundColor: "#FEF2F2", color: "#B91C1C" }}>
            {pendingError}
          </div>
        )}

        {pendingLoading ? (
          <Spinner />
        ) : pendingUsers.length === 0 ? (
          <div
            style={{
              padding: "40px",
              borderRadius: 18,
              border: "1px dashed rgba(0,0,0,0.12)",
              textAlign: "center",
              color: "#475569",
            }}
          >
            No pending accounts at the moment.
          </div>
        ) : (
          pendingUsers.map((user) => {
            const availablePlayers = playersForUser(user);
            return (
              <div
                key={user.uid}
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  backgroundColor: "#fff",
                  boxShadow: "0 15px 30px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {user.fullName || user.username || "Unknown user"}
                    </div>
                    <div style={{ color: "#475569", fontSize: 14, marginTop: 4 }}>
                      {user.email}
                      {user.teamName ? ` · ${user.teamName}` : ""}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: user.playerDocId ? "#15803D" : "#D97706",
                      }}
                    >
                      {user.playerDocId
                        ? `Linked: ${user.matchedPlayerName || user.playerID || "a player"}`
                        : "No player linked yet"}
                    </div>
                  </div>
                  <div
                    style={{
                      minWidth: 220,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      disabled={sendingUid === user.uid || user.verifyUser}
                      onClick={() => handleApproveUser(user)}
                      style={{
                        borderRadius: 10,
                        border: "none",
                        background: "#FF681F",
                        color: "white",
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor:
                          sendingUid === user.uid || user.verifyUser
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {sendingUid === user.uid
                        ? "Approving..."
                        : user.verifyUser
                        ? "Approved"
                        : "Approve user"}
                    </button>
                    <button
                      type="button"
                      disabled={linkingUid === user.uid || user.playerDocId}
                      onClick={() => handleAutoLink(user)}
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "white",
                        padding: "10px 14px",
                        fontWeight: 700,
                        cursor:
                          linkingUid === user.uid || user.playerDocId
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {linkingUid === user.uid ? "Matching..." : "Run auto-link"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxWidth: 560,
                  }}
                >
                  <label
                    htmlFor={`manual-link-${user.uid}`}
                    style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}
                  >
                    Manual linking
                  </label>
                  <select
                    id={`manual-link-${user.uid}`}
                    value={manualSelection[user.uid] || ""}
                    onChange={(event) => handleManualSelect(user.uid, event.target.value)}
                    disabled={playersLoading}
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.2)",
                      padding: "10px",
                      fontSize: 14,
                      backgroundColor: "#fff",
                    }}
                  >
                    <option value="">Select a player</option>
                    {availablePlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name} {player.playerID ? `(${player.playerID})` : ""}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      disabled={!manualSelection[user.uid] || linkingUid === user.uid}
                      onClick={() => handleManualLink(user)}
                      style={{
                        borderRadius: 10,
                        border: "none",
                        padding: "10px 14px",
                        fontWeight: 700,
                        background: "#111",
                        color: "white",
                        cursor:
                          !manualSelection[user.uid] || linkingUid === user.uid
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      Link selected player
                    </button>
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {availablePlayers.length === 0 && !playersLoading
                        ? "No roster entries for this team."
                        : ""}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "#475569" }}>
                  {statusMap[user.uid] ||
                    (user.verifyUser ? "Admin approved" : "Needs admin approval")}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VerificationQueue;
