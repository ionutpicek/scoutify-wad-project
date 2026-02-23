import React, { useEffect, useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { db, getDocsLogged as getDocs } from "../firebase.jsx";
import { getTacticalLineupPlan } from "../api/ai.js";
import { getCurrentUser } from "../services/sessionStorage.js";
import "./TacticalPlanner.css";

const FORMATION_TEMPLATES = {
  "4-3-3": ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "RW", "ST", "LW"],
  "4-2-3-1": ["GK", "RB", "RCB", "LCB", "LB", "RDM", "LDM", "CAM", "RW", "LW", "ST"],
  "4-4-2": ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "RST", "LST"],
  "4-3-1-2": ["GK", "RB", "RCB", "LCB", "LB", "DM", "RCM", "LCM", "CAM", "RST", "LST"],
  "3-4-3": ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RW", "ST", "LW"],
  "3-5-2": ["GK", "RCB", "CB", "LCB", "RWB", "LWB", "RCM", "LCM", "CAM", "RST", "LST"],
};

const FORMATION_LABELS = {
  "4-3-1-2": "4-4-2 Diamond",
};

const formationLabel = formation => FORMATION_LABELS[formation] || formation;

const normalizeFormationKey = value => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (FORMATION_TEMPLATES[raw]) return raw;
  const compact = raw.toLowerCase().replace(/[()\s]/g, "");
  if (compact === "4-4-2diamond" || compact === "442diamond") return "4-3-1-2";
  return null;
};

const POSITION_OPTIONS = [
  "GK",
  "RB",
  "RCB",
  "CB",
  "LCB",
  "LB",
  "RWB",
  "LWB",
  "RDM",
  "LDM",
  "DM",
  "RCM",
  "CM",
  "LCM",
  "CAM",
  "RM",
  "LM",
  "RW",
  "LW",
  "RST",
  "LST",
  "ST",
];

const normalizeTeamKey = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const buildIdCandidates = value => {
  const set = new Set();
  if (value == null) return set;

  const add = candidate => {
    if (candidate == null) return;
    const asString = String(candidate).trim();
    if (!asString) return;
    set.add(asString);
    const asNumber = Number(asString);
    if (Number.isFinite(asNumber)) {
      set.add(String(asNumber));
    }
  };

  add(value);
  return set;
};

const buildLineupFromFormation = (formation, current) => {
  const template = FORMATION_TEMPLATES[formation] || FORMATION_TEMPLATES["4-3-3"];
  return template.map((position, index) => ({
    playerDocId: current?.[index]?.playerDocId || "",
    name: current?.[index]?.name || "",
    position,
  }));
};

const filterPlayersByTeam = ({ players, teamDoc, teamName }) => {
  if (!Array.isArray(players) || !players.length) return [];

  const selectedTeamIds = new Set([
    ...(teamDoc ? buildIdCandidates(teamDoc.teamID) : []),
    ...(teamDoc ? buildIdCandidates(teamDoc.id) : []),
  ]);
  const selectedTeamKey = normalizeTeamKey(teamDoc?.name || teamName || "");

  return players
    .filter(player => {
      const playerTeamIds = buildIdCandidates(player.teamID);
      const hasIdMatch =
        selectedTeamIds.size > 0 &&
        Array.from(playerTeamIds).some(playerId => selectedTeamIds.has(playerId));

      const playerTeamKey = normalizeTeamKey(player.teamName || player.team || "");
      const hasNameMatch =
        Boolean(selectedTeamKey) &&
        Boolean(playerTeamKey) &&
        (playerTeamKey === selectedTeamKey ||
          playerTeamKey.includes(selectedTeamKey) ||
          selectedTeamKey.includes(playerTeamKey));

      return hasIdMatch || hasNameMatch;
    })
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
};

const clampChart = (value, min, max) => Math.max(min, Math.min(max, value));

const chartPointTitle = point =>
  [point?.label, point?.opponent ? `vs ${point.opponent}` : null, point?.grade != null ? `Grade ${point.grade}` : null]
    .filter(Boolean)
    .join(" | ");

const buildLinePath = points => {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
};

function LineChart2D({
  series = [],
  height = 180,
  compact = false,
}) {
  const chartSeries = useMemo(() => {
    const left = compact ? 4 : 8;
    const right = 3;
    const top = 6;
    const bottom = compact ? 8 : 14;
    const innerWidth = 100 - left - right;
    const innerHeight = 100 - top - bottom;
    const yMin = 1;
    const yMax = 10;

    return series.map(item => {
      const pointsRaw = Array.isArray(item?.data)
        ? item.data.filter(point => Number.isFinite(Number(point?.grade)))
        : [];
      const count = pointsRaw.length;
      const points = pointsRaw.map((point, index) => {
        const grade = Number(point.grade);
        const x =
          count <= 1
            ? left + innerWidth / 2
            : left + (index / (count - 1)) * innerWidth;
        const normalized = clampChart((grade - yMin) / (yMax - yMin), 0, 1);
        const y = top + (1 - normalized) * innerHeight;
        return {
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          grade,
          label: point?.label || "",
          opponent: point?.opponent || "",
        };
      });

      return {
        ...item,
        points,
        path: buildLinePath(points),
      };
    });
  }, [compact, series]);

  const hasData = chartSeries.some(item => item.points.length);

  return (
    <div className={`tactical-chart ${compact ? "compact" : ""}`} style={{ height }}>
      {!hasData ? (
        <div className="tactical-chart-empty">No grade history yet.</div>
      ) : (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="tactical-chart-svg">
          {[20, 40, 60, 80].map(y => (
            <line
              key={`grid-${y}`}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              className="tactical-chart-grid-line"
            />
          ))}

          {!compact ? (
            <>
              <text x="1.5" y="8" className="tactical-chart-axis-text">10</text>
              <text x="1.5" y="94" className="tactical-chart-axis-text">1</text>
              <text x="8" y="98" className="tactical-chart-axis-text">Recent</text>
              <text x="84" y="98" className="tactical-chart-axis-text">Latest</text>
            </>
          ) : null}

          {chartSeries.map(item => (
            <g key={item.id || item.name}>
              {item.path ? (
                <path
                  d={item.path}
                  fill="none"
                  stroke={item.color || "#ff681f"}
                  strokeWidth={compact ? 2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {item.points.map((point, index) => (
                <circle
                  key={`${item.id || item.name}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={compact ? 1.8 : 1.6}
                  fill={item.color || "#ff681f"}
                  stroke="#fff"
                  strokeWidth="0.45"
                >
                  <title>{chartPointTitle(point)}</title>
                </circle>
              ))}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

export default function TacticalPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = useMemo(() => getCurrentUser(), []);
  const routeState = location.state || {};

  const role = routeState.userRole || routeState.role || storedUser?.role || "guest";
  const canAccessPlanner = role === "admin" || role === "manager";
  const isAdmin = role === "admin";
  const userTeam = routeState.userTeam || storedUser?.teamName || storedUser?.userTeam || "";
  const username = routeState.username || storedUser?.username || "Scout";

  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  const [myTeamDocId, setMyTeamDocId] = useState("");
  const [opponentTeamDocId, setOpponentTeamDocId] = useState("");
  const [unavailablePlayerDocIds, setUnavailablePlayerDocIds] = useState([]);
  const [preferredFormation, setPreferredFormation] = useState("4-3-3");
  const [matchVenue, setMatchVenue] = useState("home");
  const [opponentFormation, setOpponentFormation] = useState("4-3-3");
  const [opponentLineup, setOpponentLineup] = useState(() =>
    buildLineupFromFormation("4-3-3")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!canAccessPlanner) {
      setCatalogLoading(false);
      setCatalogError("");
      return;
    }

    let cancelled = false;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError("");

      try {
        const [teamsSnap, playersSnap] = await Promise.all([
          getDocs(collection(db, "team")),
          getDocs(collection(db, "player")),
        ]);

        if (cancelled) return;

        const teamsRows = teamsSnap.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

        const playerRows = playersSnap.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

        setTeams(teamsRows);
        setPlayers(playerRows);
      } catch (loadError) {
        if (!cancelled) {
          setCatalogError(loadError?.message || "Unable to load teams and players.");
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [canAccessPlanner]);

  useEffect(() => {
    setOpponentLineup(prev => buildLineupFromFormation(opponentFormation, prev));
  }, [opponentFormation]);

  useEffect(() => {
    setOpponentLineup(prev =>
      prev.map(entry => ({
        ...entry,
        playerDocId: "",
        name: "",
      }))
    );
  }, [opponentTeamDocId]);

  useEffect(() => {
    if (!isAdmin) return;
    if (myTeamDocId || !userTeam || !teams.length) return;

    const userTeamKey = normalizeTeamKey(userTeam);
    const matched = teams.find(team => normalizeTeamKey(team?.name || "") === userTeamKey);
    if (matched) {
      setMyTeamDocId(matched.id);
    }
  }, [isAdmin, myTeamDocId, teams, userTeam]);

  const selectedOpponentTeam = useMemo(
    () => teams.find(team => team.id === opponentTeamDocId) || null,
    [teams, opponentTeamDocId]
  );

  const selectedMyTeam = useMemo(
    () => teams.find(team => team.id === myTeamDocId) || null,
    [teams, myTeamDocId]
  );

  const managerTeamDoc = useMemo(() => {
    if (isAdmin || !teams.length || !userTeam) return null;
    const userTeamKey = normalizeTeamKey(userTeam);
    return teams.find(team => normalizeTeamKey(team?.name || "") === userTeamKey) || null;
  }, [isAdmin, teams, userTeam]);

  const effectiveTeamName = isAdmin
    ? selectedMyTeam?.name || ""
    : userTeam || "";

  useEffect(() => {
    const sourceTeamDoc = isAdmin ? selectedMyTeam : managerTeamDoc;
    if (!sourceTeamDoc) return;
    const teamPreferredFormation = normalizeFormationKey(
      sourceTeamDoc.preferredFormation || sourceTeamDoc.formation || ""
    );
    if (teamPreferredFormation) {
      setPreferredFormation(teamPreferredFormation);
    }
  }, [isAdmin, managerTeamDoc, selectedMyTeam]);

  const opponentPlayers = useMemo(() => {
    if (!selectedOpponentTeam) return [];
    return filterPlayersByTeam({
      players,
      teamDoc: selectedOpponentTeam,
      teamName: selectedOpponentTeam?.name || "",
    });
  }, [players, selectedOpponentTeam]);

  const ownTeamPlayers = useMemo(
    () =>
      filterPlayersByTeam({
        players,
        teamDoc: selectedMyTeam,
        teamName: effectiveTeamName,
      }),
    [players, selectedMyTeam, effectiveTeamName]
  );

  useEffect(() => {
    const ownPlayerIdSet = new Set(ownTeamPlayers.map(player => player.id));
    setUnavailablePlayerDocIds(prev =>
      prev.filter(playerId => ownPlayerIdSet.has(playerId))
    );
  }, [ownTeamPlayers]);

  const opponentPlayersById = useMemo(() => {
    const map = new Map();
    opponentPlayers.forEach(player => map.set(player.id, player));
    return map;
  }, [opponentPlayers]);

  const selectedOpponentCount = useMemo(
    () => opponentLineup.filter(entry => entry.playerDocId).length,
    [opponentLineup]
  );

  const availableOwnPlayersCount = useMemo(
    () =>
      ownTeamPlayers.filter(player => !unavailablePlayerDocIds.includes(player.id)).length,
    [ownTeamPlayers, unavailablePlayerDocIds]
  );

  const handleLineupPlayerChange = (index, playerDocId) => {
    setOpponentLineup(prev =>
      prev.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        const player = opponentPlayersById.get(playerDocId);
        return {
          ...entry,
          playerDocId,
          name: player?.name || "",
        };
      })
    );
  };

  const handleLineupPositionChange = (index, position) => {
    setOpponentLineup(prev =>
      prev.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              position,
            }
          : entry
      )
    );
  };

  const clearSelections = () => {
    setOpponentLineup(prev =>
      prev.map(entry => ({
        ...entry,
        playerDocId: "",
        name: "",
      }))
    );
  };

  const toggleUnavailablePlayer = playerDocId => {
    setUnavailablePlayerDocIds(prev =>
      prev.includes(playerDocId)
        ? prev.filter(id => id !== playerDocId)
        : [...prev, playerDocId]
    );
  };

  const clearUnavailablePlayers = () => {
    setUnavailablePlayerDocIds([]);
  };

  const handleGeneratePlan = async event => {
    event.preventDefault();

    if (!effectiveTeamName.trim()) {
      setError(
        isAdmin
          ? "Select your team to compute the best XI."
          : "Your account must have a team assigned."
      );
      return;
    }

    if (!selectedOpponentTeam) {
      setError("Select an opponent team first.");
      return;
    }

    if (selectedOpponentCount < 8) {
      setError("Select at least 8 opponent players from the list.");
      return;
    }

    if (availableOwnPlayersCount < 11) {
      setError("You must keep at least 11 available players in your team.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        teamName: effectiveTeamName.trim(),
        preferredFormation,
        matchVenue,
        opponentTeamName: selectedOpponentTeam?.name || null,
        opponentFormation,
        opponentLineup: opponentLineup.map(entry => ({
          name: entry.name.trim(),
          position: entry.position,
        })),
        unavailablePlayerDocIds: unavailablePlayerDocIds,
      };

      const response = await getTacticalLineupPlan(payload);
      setResult(response);
    } catch (err) {
      setError(err.message || "Could not generate tactical lineup plan.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const recommendation = result?.recommendation || null;
  const advice = result?.advice || null;
  const knownOpponent = result?.opponent?.knownPlayers ?? 0;
  const formCharts = result?.formCharts || null;
  const winChancePct = recommendation?.winChancePct;
  const drawChancePct = recommendation?.drawChancePct;
  const opponentWinChancePct = recommendation?.opponentWinChancePct;
  const opponentTeamName = result?.opponent?.teamName || "Opponent";
  const teamFormCharts = formCharts?.teams || null;
  const playerFormCharts = Array.isArray(formCharts?.players) ? formCharts.players : [];

  const outcomeProbabilities = useMemo(() => {
    const own = Number(winChancePct);
    const draw = Number(drawChancePct);
    const opponent = Number(opponentWinChancePct);

    if (
      Number.isFinite(own) &&
      Number.isFinite(draw) &&
      Number.isFinite(opponent)
    ) {
      const total = own + draw + opponent;
      if (total > 0) {
        const ownNorm = Math.round((own / total) * 100);
        const drawNorm = Math.round((draw / total) * 100);
        const opponentNorm = Math.max(0, 100 - ownNorm - drawNorm);
        return { own: ownNorm, draw: drawNorm, opponent: opponentNorm };
      }
    }

    if (Number.isFinite(own)) {
      const ownSafe = Math.max(0, Math.min(100, Math.round(own)));
      const balance = 1 - Math.min(1, Math.abs(ownSafe - 50) / 45);
      let drawSafe = Math.round(12 + balance * 20);
      drawSafe = Math.min(drawSafe, Math.max(0, 100 - ownSafe));
      const opponentSafe = Math.max(0, 100 - ownSafe - drawSafe);
      return { own: ownSafe, draw: drawSafe, opponent: opponentSafe };
    }

    return { own: 0, draw: 0, opponent: 0 };
  }, [winChancePct, drawChancePct, opponentWinChancePct]);

  const teamFormSeries = useMemo(() => {
    if (!teamFormCharts) return [];
    return [
      {
        id: "own-team",
        name: teamFormCharts.ownTeamName || effectiveTeamName || "Your team",
        color: "#16a34a",
        data: Array.isArray(teamFormCharts.ownSeries) ? teamFormCharts.ownSeries : [],
      },
      {
        id: "opp-team",
        name: teamFormCharts.opponentTeamName || opponentTeamName || "Opponent",
        color: "#ef4444",
        data: Array.isArray(teamFormCharts.opponentSeries) ? teamFormCharts.opponentSeries : [],
      },
    ];
  }, [effectiveTeamName, opponentTeamName, teamFormCharts]);

  if (!canAccessPlanner) {
    return (
      <div className="tactical-page">
        <Header
          title="Tactical Match Planner"
          subtitle={`Build your best XI vs predicted opponent lineup - ${username}`}
          role={role}
          team={userTeam || "Your team"}
          onBack={() => navigate(-1)}
          onLogout={() => navigate("/login")}
        />

        <div className="tactical-content">
          <section className="tactical-panel tactical-panel--form">
            <h2>Access Restricted</h2>
            <p className="tactical-muted">
              Opponent Planner is available only for managers and admins.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="tactical-page">
      <Header
        title="Tactical Match Planner"
        subtitle={`Build your best XI vs predicted opponent lineup - ${username}`}
        role={role}
        team={effectiveTeamName || userTeam || "Your team"}
        onBack={() => navigate(-1)}
        onLogout={() => navigate("/login")}
      />

      <div className="tactical-content">
        <section className="tactical-panel tactical-panel--form">
          <h2>Opponent Setup</h2>
          <p className="tactical-muted">
            Select the opponent team first, then pick players directly from the roster list.
          </p>

          <form onSubmit={handleGeneratePlan}>
            <div className="tactical-fields">
              <label>
                <span>{isAdmin ? "Your Team" : "Preferred Formation"}</span>
                {isAdmin ? (
                  <select
                    value={myTeamDocId}
                    onChange={event => setMyTeamDocId(event.target.value)}
                    disabled={catalogLoading}
                    required
                  >
                    <option value="">Select your team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name || "Unnamed team"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={preferredFormation}
                    onChange={event => setPreferredFormation(event.target.value)}
                  >
                    {Object.keys(FORMATION_TEMPLATES).map(formation => (
                      <option key={formation} value={formation}>
                        {formationLabel(formation)}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {isAdmin ? (
                <label>
                  <span>Preferred Formation</span>
                  <select
                    value={preferredFormation}
                    onChange={event => setPreferredFormation(event.target.value)}
                  >
                    {Object.keys(FORMATION_TEMPLATES).map(formation => (
                      <option key={formation} value={formation}>
                        {formationLabel(formation)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label>
                <span>Opponent Team</span>
                <select
                  value={opponentTeamDocId}
                  onChange={event => setOpponentTeamDocId(event.target.value)}
                  disabled={catalogLoading}
                >
                  <option value="">Select opponent team</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name || "Unnamed team"}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Opponent Formation</span>
                <select
                  value={opponentFormation}
                  onChange={event => setOpponentFormation(event.target.value)}
                >
                  {Object.keys(FORMATION_TEMPLATES).map(formation => (
                    <option key={formation} value={formation}>
                      {formationLabel(formation)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Match Venue</span>
                <select
                  value={matchVenue}
                  onChange={event => setMatchVenue(event.target.value)}
                >
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </label>
            </div>

            <div className="tactical-lineup-head">
              <h3>Unavailable Players (Your Team)</h3>
              <button
                type="button"
                className="tactical-ghost-btn"
                onClick={clearUnavailablePlayers}
                disabled={!unavailablePlayerDocIds.length}
              >
                Clear unavailable
              </button>
            </div>

            <div className="tactical-helper-row">
              <p className="tactical-helper-text">
                {effectiveTeamName
                  ? `${availableOwnPlayersCount} available out of ${ownTeamPlayers.length} players.`
                  : "Select your team first to manage unavailable players."}
              </p>
            </div>

            <div className="tactical-unavailable-grid">
              {effectiveTeamName && ownTeamPlayers.length ? (
                ownTeamPlayers.map(player => {
                  const checked = unavailablePlayerDocIds.includes(player.id);
                  return (
                    <label
                      key={player.id}
                      className={`tactical-unavailable-item ${checked ? "checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUnavailablePlayer(player.id)}
                      />
                      <span>{player.name || "Unnamed player"}</span>
                      <small>{player.position || "Unknown role"}</small>
                    </label>
                  );
                })
              ) : (
                <p className="tactical-muted">
                  No players found for your team yet.
                </p>
              )}
            </div>

            {catalogError ? <div className="tactical-error">{catalogError}</div> : null}

            <div className="tactical-lineup-head">
              <h3>Predicted Opponent XI</h3>
              <button type="button" className="tactical-ghost-btn" onClick={clearSelections}>
                Clear selections
              </button>
            </div>

            <div className="tactical-helper-row">
              <p className="tactical-helper-text">
                {selectedOpponentTeam
                  ? `${opponentPlayers.length} players available from ${selectedOpponentTeam.name || "selected team"}.`
                  : "Select an opponent team to unlock the player dropdown list."}
              </p>
            </div>

            <div className="tactical-lineup-grid">
              {opponentLineup.map((entry, index) => (
                <div key={`opponent-${index}`} className="tactical-lineup-row">
                  <span className="tactical-row-number">{index + 1}</span>
                  <select
                    value={entry.playerDocId || ""}
                    onChange={event => handleLineupPlayerChange(index, event.target.value)}
                    disabled={!selectedOpponentTeam || !opponentPlayers.length}
                  >
                    <option value="">
                      {!selectedOpponentTeam
                        ? "Select team first"
                        : opponentPlayers.length
                        ? "Select player"
                        : "No players available"}
                    </option>
                    {opponentPlayers.map(player => {
                      const usedElsewhere = opponentLineup.some(
                        (otherEntry, otherIndex) =>
                          otherIndex !== index && otherEntry.playerDocId === player.id
                      );

                      return (
                        <option key={player.id} value={player.id} disabled={usedElsewhere}>
                          {player.name || "Unnamed player"}
                          {player.position ? ` (${player.position})` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={entry.position}
                    onChange={event => handleLineupPositionChange(index, event.target.value)}
                  >
                    {POSITION_OPTIONS.map(position => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {error ? <div className="tactical-error">{error}</div> : null}

            <button type="submit" className="tactical-submit-btn" disabled={loading || catalogLoading}>
              {loading ? "Generating..." : "Generate best XI and advice"}
            </button>
          </form>
        </section>

        <section className="tactical-panel tactical-panel--result">
          {!loading && !recommendation ? (
            <div className="tactical-empty">
              <h3>No plan generated yet</h3>
              <p>Submit opponent lineup data to receive recommended formation, XI and tactical advice.</p>
            </div>
          ) : null}

          {loading ? (
            <div className="tactical-loading">
              <Spinner />
              <p>Computing tactical lineup...</p>
            </div>
          ) : null}

          {!loading && recommendation ? (
            <div className="tactical-result">
              <div className="tactical-summary-grid">
                <div className="tactical-summary-card">
                  <span>Recommended formation</span>
                  <strong>{formationLabel(recommendation.formation)}</strong>
                </div>
                <div className="tactical-summary-card">
                  <span>Model score</span>
                  <strong>{recommendation.score}</strong>
                </div>
                <div className="tactical-summary-card">
                  <span>Win chance</span>
                  <strong>{Number.isFinite(winChancePct) ? `${winChancePct}%` : "-"}</strong>
                </div>
                <div className="tactical-summary-card">
                  <span>Opponent players recognized</span>
                  <strong>{knownOpponent}/11</strong>
                </div>
              </div>

              <div className="tactical-outcome-wrap">
                <div className="tactical-outcome-bar" role="img" aria-label="Match outcome probability distribution">
                  <div
                    className="tactical-outcome-segment tactical-outcome-segment--own"
                    style={{ width: `${outcomeProbabilities.own}%` }}
                    title={`${effectiveTeamName || "Your team"} win ${outcomeProbabilities.own}%`}
                  >
                    {outcomeProbabilities.own >= 10 ? `${outcomeProbabilities.own}%` : ""}
                  </div>
                  <div
                    className="tactical-outcome-segment tactical-outcome-segment--draw"
                    style={{ width: `${outcomeProbabilities.draw}%` }}
                    title={`Draw ${outcomeProbabilities.draw}%`}
                  >
                    {outcomeProbabilities.draw >= 10 ? `${outcomeProbabilities.draw}%` : ""}
                  </div>
                  <div
                    className="tactical-outcome-segment tactical-outcome-segment--opponent"
                    style={{ width: `${outcomeProbabilities.opponent}%` }}
                    title={`${opponentTeamName} win ${outcomeProbabilities.opponent}%`}
                  >
                    {outcomeProbabilities.opponent >= 10 ? `${outcomeProbabilities.opponent}%` : ""}
                  </div>
                </div>
                <div className="tactical-outcome-legend">
                  <span>{effectiveTeamName || "Your team"}: {outcomeProbabilities.own}%</span>
                  <span>Draw: {outcomeProbabilities.draw}%</span>
                  <span>{opponentTeamName}: {outcomeProbabilities.opponent}%</span>
                </div>
              </div>

              <h3>Best First XI</h3>
              <div className="tactical-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Player</th>
                      <th>Role</th>
                      <th>Fit</th>
                      <th>Strengths</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendation.lineup.map(entry => (
                      <tr key={`${entry.slot}-${entry.playerDocId || entry.name}`}>
                        <td>{entry.slot}</td>
                        <td>{entry.name}</td>
                        <td>{entry.role}</td>
                        <td>{entry.fitScore ?? "-"}</td>
                        <td>{entry.strengths?.length ? entry.strengths.join(", ") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Bench Options</h3>
              <div className="tactical-bench">
                {recommendation.bench?.length ? (
                  recommendation.bench.map(player => (
                    <div key={player.playerDocId || player.name} className="tactical-chip">
                      {player.name} - {player.role} - {player.score}
                    </div>
                  ))
                ) : (
                  <p className="tactical-muted">No bench recommendations available.</p>
                )}
              </div>

              <div className="tactical-advice-grid">
                <div>
                  <h4>Key Weaknesses</h4>
                  <ul>
                    {(advice?.keyWeaknesses || []).map(item => (
                      <li key={`weak-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>How To Put Them In Danger</h4>
                  <ul>
                    {(advice?.attackingPlan || []).map(item => (
                      <li key={`attack-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Pressing Triggers</h4>
                  <ul>
                    {(advice?.pressingTriggers || []).map(item => (
                      <li key={`press-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Caution Points</h4>
                  <ul>
                    {(advice?.cautionPoints || []).map(item => (
                      <li key={`caution-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
