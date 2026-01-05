import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { getMatch, uploadMatchMetrics } from "../api/matches";
import { db, getDocLogged as getDoc } from "../firebase";
import { doc } from "firebase/firestore";

export default function MatchPage() {
  // Cache coaches by teamId to avoid repeated Firestore reads across renders/pages
  const coachCache = React.useRef(new Map());
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [coaches, setCoaches] = useState({ home: {}, away: {} });
  const [metricsFiles, setMetricsFiles] = useState({ home: null, away: null });
  const [metricsUploading, setMetricsUploading] = useState({ home: false, away: false });
  const [viewMode, setViewMode] = useState("lineups"); // lineups | teamstats

  const loadMatch = async () => {
    try {
      const data = await getMatch(id);
      setMatch(data);
    } catch (e) {
      console.error("Failed to load match", e);
    }
  };

  useEffect(() => {
    loadMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const prevOverflowX = document.body.style.overflowX;
    const prevOverflowY = document.body.style.overflowY;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    const prevHtmlOverflowY = document.documentElement.style.overflowY;

    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = "auto";
    document.documentElement.style.overflowX = "hidden";
    document.documentElement.style.overflowY = "auto";

    return () => {
      document.body.style.overflowX = prevOverflowX;
      document.body.style.overflowY = prevOverflowY;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
      document.documentElement.style.overflowY = prevHtmlOverflowY;
    };
  }, []);

  const handleMetricsFileChange = (sideKey, fileObj) => {
    setMetricsFiles(prev => ({ ...prev, [sideKey]: fileObj || null }));
  };

  const handleMetricsUpload = async sideKey => {
    const file = metricsFiles[sideKey];
    if (!file) return;
    setMetricsUploading(prev => ({ ...prev, [sideKey]: true }));
    try {
      await uploadMatchMetrics(id, sideKey, file);
      await loadMatch(); // refresh match to pull new notes
      setMetricsFiles(prev => ({ ...prev, [sideKey]: null }));
    } catch (e) {
      console.error(e);
      alert("Metrics upload failed");
    } finally {
      setMetricsUploading(prev => ({ ...prev, [sideKey]: false }));
    }
  };

  const best = () => {
    const pool = match?.bestPerformers || match?.bestPerformer || {};
    const home = pool.home;
    const away = pool.away;
    if (!home && !away) return null;

    const score = p => {
      if (!p) return -Infinity;
      const grade = Number(p.gameGrade ?? p.grade ?? 0);
      const impact = Number(p.impactScore ?? 0);
      return grade * 10 + impact;
    };

    const winner = score(home) >= score(away) ? home : away;
    if (!winner) return null;
    const grade = winner.gameGrade ?? winner.grade;
    return `${winner.name || winner.canonicalName || "N/A"}${grade != null ? " " + Number(grade).toFixed(1) : ""}`;
  };

  const players = Array.isArray(match?.players) ? match.players : [];

  const normalize = str =>
    String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s.]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const homeTeamIdFromPlayers = players.find(p => p.team === "home" && (p.teamId || p.teamID))?.teamId
    || players.find(p => p.team === "home" && (p.teamId || p.teamID))?.teamID;
  const awayTeamIdFromPlayers = players.find(p => p.team === "away" && (p.teamId || p.teamID))?.teamId
    || players.find(p => p.team === "away" && (p.teamId || p.teamID))?.teamID;

  const sortPlayers = list => {
    const group = pos => {
      const p = String(pos || "").toUpperCase();
      if (p === "GK") return 0;
      if (p.includes("B")) return 1; // backs (CB, RB, LB, WB...)
      if (p.includes("M")) return 2; // midfielders
      return 3; // others (attackers, unknown)
    };

    return [...list].sort((a, b) => {
      const gA = group(a.position);
      const gB = group(b.position);
      if (gA !== gB) return gA - gB;

      const minA = Number(a.minutesPlayed || 0);
      const minB = Number(b.minutesPlayed || 0);
      if (minB !== minA) return minB - minA;

      const nameA = a.canonicalName || a.name || "";
      const nameB = b.canonicalName || b.name || "";
      return nameA.localeCompare(nameB);
    });
  };

  const homePlayers = sortPlayers(
    players.filter(
      p => String(p.teamId || p.teamID) == String(match.homeTeamId || match.hometeamID) || p.team == "home"
    )
  );

  const awayPlayers = sortPlayers(
    players.filter(
      p => String(p.teamId || p.teamID) == String(match.awayTeamId || match.awayteamID) || p.team == "away"
    )
  );

  useEffect(() => {
    const loadCoaches = async () => {
      if (!match) return;

      const fetchCoach = async (teamId, fallbackName) => {
        if (!teamId) return {};

        const cleanName = fallbackName ? String(fallbackName).trim() : null;
        const buildCoach = data => ({
          name: data?.coach || data?.coachName || cleanName || null,
          photo: data?.coachURL || data?.coachUrl || null
        });

        // Cached?
        if (coachCache.current.has(teamId)) {
          return coachCache.current.get(teamId);
        }

        try {
          const snap = await getDoc(doc(db, "team", String(teamId)));
          if (snap.exists()) {
            const coach = buildCoach(snap.data());
            coachCache.current.set(teamId, coach);
            return coach;
          }
        } catch (e) {
          console.error("Coach fetch failed", e);
        }

        coachCache.current.set(teamId, {});
        return {};
      };

      const [homeCoach, awayCoach] = await Promise.all([
        fetchCoach(
          match.homeTeamId || match.hometeamID || homeTeamIdFromPlayers,
          match.homeTeam
        ),
        fetchCoach(
          match.awayTeamId || match.awayteamID || awayTeamIdFromPlayers,
          match.awayTeam
        )
      ]);
      setCoaches({ home: homeCoach, away: awayCoach });
    };

    loadCoaches();
  }, [match, homeTeamIdFromPlayers, awayTeamIdFromPlayers]);

  // Wait for match data before rendering UI
  if (!match) return <Spinner style={{display:"flex", justifyContent:"center"}}/>;

  const ROW_HEIGHT = 60;

  const renderPlayers = (
    list,
    padAfterPlayers = 0,
  ) => {
    const played = list.filter(p => Number(p.minutesPlayed || 0) > 0);

    let starters = played.filter(p => p.starter);
    let subsPlayed = played.filter(p => !p.starter);

    // Fallback/fix: ensure at most 11 starters; demote extras to subs, and promote top played if none marked.
    if (starters.length === 0 && played.length > 0) {
      // No starters flagged; take top 11 by minutes
      const sorted = [...played].sort((a, b) => Number(b.minutesPlayed || 0) - Number(a.minutesPlayed || 0));
      starters = sorted.slice(0, 11);
      subsPlayed = sorted.slice(11);
    } else if (starters.length > 11) {
      const sortedStarters = [...starters].sort((a, b) => Number(b.minutesPlayed || 0) - Number(a.minutesPlayed || 0));
      starters = sortedStarters.slice(0, 11);
      subsPlayed = [...subsPlayed, ...sortedStarters.slice(11)];
    }

    const gradeChip = (grade, delta) => {
      const numGrade = grade == null ? null : Number(grade);
      const deltaNum = delta == null ? null : Number(delta);

      const color =
        deltaNum > 0
          ? "#0b8a42"
          : deltaNum < 0
            ? "#c62828"
            : "#2c2c2c";

      const bg =
        deltaNum > 0
          ? "#e6f4ea"
          : deltaNum < 0
            ? "#fdecea"
            : "#f4f4f4";

      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              color,
              fontWeight: 800,
              fontSize: 16
            }}
          >
            {numGrade != null ? numGrade.toFixed(1) : "-"}
          </span>
          {deltaNum != null && (
            <span
              style={{
                color,
                background: bg,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {deltaNum > 0 ? "+" : ""}
              {deltaNum.toFixed(1)}
            </span>
          )}
        </div>
      );
    };

    const renderList = items =>
      items.map(p => (
        <div
          key={`${p.playerId || p.name}-${p.teamID || "unknown"}`}
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "10px 0",
            borderBottom: "1px solid #f0f0f0",
            color: "#1b1b1b"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {p.number != null ? `${p.number}. ` : ""}
              {p.canonicalName || p.name}
            </span>
            <span style={{ fontSize: 12, color: "#888", whiteSpace:"nowrap" }}>
              {p.position || "-"} • {p.minutesPlayed ?? 0}'
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12 }}>
            {gradeChip(p.grade ?? p.gameGrade?.overall10, p.delta)}
          </div>
        </div>
      ));

    const padRows = (count, keyPrefix = "pad") =>
      Array.from({ length: count }, (_, idx) => (
        <div
          key={`${keyPrefix}-${idx}`}
          style={{
            height: ROW_HEIGHT,
            padding: "8px 0",
            borderBottom: "1px solid transparent",
            visibility: "hidden"
          }}
        />
      ));

    return (
      <div>
        {renderList(starters)}
        {subsPlayed.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #f1f1f1" }}>
            <div style={{ fontWeight: 700, color: "#666", marginBottom: 6 }}>
              Substitutes (played)
            </div>
            {renderList(subsPlayed)}
          </div>
        )}
        {padAfterPlayers > 0 && padRows(padAfterPlayers, "padAfter")}
      </div>
    );
  };

  const homePlayedCount = homePlayers.filter(p => Number(p.minutesPlayed || 0) > 0).length;
  const awayPlayedCount = awayPlayers.filter(p => Number(p.minutesPlayed || 0) > 0).length;
  const maxPlayed = Math.max(homePlayedCount, awayPlayedCount);

  const homeBenchCount = homePlayers.filter(p => Number(p.minutesPlayed || 0) === 0).length;
  const awayBenchCount = awayPlayers.filter(p => Number(p.minutesPlayed || 0) === 0).length;
  const maxBench = Math.max(homeBenchCount, awayBenchCount);
  const maxTotalRows = maxPlayed + maxBench;
  const homePadAfterBench = maxBench - homeBenchCount;
  const awayPadAfterBench = maxBench - awayBenchCount;
  const homePadAfter = maxTotalRows - (homePlayedCount + homeBenchCount);
  const awayPadAfter = maxTotalRows - (awayPlayedCount + awayBenchCount);

  const renderTeamStats = () => {
    const ts = match?.teamStats || {};
    const home = ts.home || {};
    const away = ts.away || {};

    const rows = [
      { label: "xG", key: "xG", fmt: v => v.toFixed(2) },
      { label: "Possession %", key: "possessionPct", fmt: v => `${v}%` },
      { label: "Shots", key: "shots" },
      { label: "Shots on target", key: "shotsOnTarget" },
      { label: "Corners", key: "corners" },
      { label: "Passes", key: "passes" },
      { label: "Passes accurate", key: "passesAccurate" },
      {
        label: "Pass accuracy %",
        key: "passAccuracyPct",
        compute: () => {
          const hPct = home.passesAccurate != null && home.passes ? (home.passesAccurate / home.passes) * 100 : null;
          const aPct = away.passesAccurate != null && away.passes ? (away.passesAccurate / away.passes) * 100 : null;
          return { home: hPct, away: aPct };
        },
        fmt: v => `${v.toFixed(1)}%`
      },
      { label: "Long pass share %", key: "longPassSharePct", fmt: v => `${v}%` },
      { label: "Duels", key: "duels" },
      { label: "Duels won", key: "duelsWon" },
      { label: "Recoveries", key: "recoveries" },
      { label: "Fouls", key: "fouls" },
      {
        label: "Yellow / Red",
        key: "cards",
        compute: () => ({
          home: home.yellow != null || home.red != null ? `${home.yellow ?? 0}/${home.red ?? 0}` : null,
          away: away.yellow != null || away.red != null ? `${away.yellow ?? 0}/${away.red ?? 0}` : null
        })
      },
      { label: "PPDA", key: "ppda", fmt: v => v.toFixed(2) },
      {
        label: "Pure possession time",
        key: "purePossessionSec",
        fmt: v => {
          const m = Math.floor(v / 60)
            .toString()
            .padStart(2, "0");
          const s = Math.floor(v % 60)
            .toString()
            .padStart(2, "0");
          return `${m}:${s}`;
        }
      },
      {
        label: "Avg possession duration",
        key: "avgPossessionDurationSec",
        fmt: v => {
          const m = Math.floor(v / 60)
            .toString()
            .padStart(2, "0");
          const s = Math.floor(v % 60)
            .toString()
            .padStart(2, "0");
          return `${m}:${s}`;
        }
      },
      {
        label: "Dead time",
        key: "deadTimeSec",
        fmt: v => {
          const m = Math.floor(v / 60)
            .toString()
            .padStart(2, "0");
          const s = Math.floor(v % 60)
            .toString()
            .padStart(2, "0");
          return `${m}:${s}`;
        }
      }
    ];

    const displayRows = rows
      .map(row => {
        if (row.compute) {
          const res = row.compute(home, away);
          return { ...row, homeVal: res.home, awayVal: res.away };
        }
        return { ...row, homeVal: home[row.key], awayVal: away[row.key] };
      })
      .filter(r => r.homeVal != null || r.awayVal != null);

    if (!displayRows.length) {
      return (
        <div style={{ padding: 16, textAlign: "center", color: "#666" }}>
          Team stats not available for this match.
        </div>
      );
    }

    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #f1f1f1",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontWeight: 700, color: "#444", paddingBottom: 8, borderBottom: "1px solid #f5f5f5" }}>
          <span style={{ textAlign: "left" }}>{match.homeTeam}</span>
          <span style={{ textAlign: "center" }}>Metric</span>
          <span style={{ textAlign: "right" }}>{match.awayTeam}</span>
        </div>
        {displayRows.map((row, idx) => {
          const fmt = row.fmt || (v => v);
          const hv = row.homeVal;
          const av = row.awayVal;
          const showH = hv != null;
          const showA = av != null;
          return (
            <div
              key={`ts-${idx}-${row.label}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: idx === displayRows.length - 1 ? "none" : "1px solid #f5f5f5",
                color: "#222"
              }}
            >
              <span style={{ textAlign: "left", fontWeight: 700 }}>
                {showH ? fmt(hv) : "-"}
              </span>
              <span style={{ textAlign: "center", fontSize: 14, color: "#666" }}>{row.label}</span>
              <span style={{ textAlign: "right", fontWeight: 700 }}>
                {showA ? fmt(av) : "-"}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

 const getBestPerformer = side => {
    const pool = match?.bestPerformers || match?.bestPerformer || {};
    return pool?.[side] || null;
  };

  const getExcelNoteLines = raw => {
    if (!raw) return [];
    return raw
      .split(" | ")
      .map(l => l.trim())
      .filter(Boolean)
      .filter(l => {
        const lower = l.toLowerCase();
        if (lower.includes("grade")) return false;
        if (lower.startsWith("score")) return false;
        if (lower.includes("goals:")) return false;
        return true;
      });
  };

  const renderCoachCard = (coach = {}, side = "left", bestPerformer = null, teamKey = "home") => {
    const displayName = coach.name || "Coach";
    const noteSource = match?.gpsMetrics ? match.gpsMetrics[teamKey] : "";
    const noteLines = getExcelNoteLines(noteSource || "");
    const bestStats = (() => {
      if (!bestPerformer) return [];
      const target = players.find(p => {
        if (bestPerformer.playerId && p.playerId === bestPerformer.playerId) return true;
        const bpName = normalize(bestPerformer.canonicalName || bestPerformer.name || bestPerformer.playerName);
        const playerName = normalize(p.canonicalName || p.name);
        return bpName && playerName && bpName === playerName;
      });
      const stats = target?.matchStats || {};
      const isGK = (target?.position || "").toUpperCase() === "GK" || (target?.rolePlayed || "").toUpperCase() === "GK";
      const ordered = isGK
        ? [
            ["Conceded Goals", stats.concededGoals],
            ["Saves", stats.saves],
            ["Shots Against", stats.shotsAgainst],
            ["Passes", stats.passes],
            ["Passes Accurate", stats.passesSuccess]
          ]
        : [
            ["Goals", stats.goals],
            ["Shots", stats.shots],
            ["xA", stats.xA],
            ["Accurate Passes", stats.passesSuccess],
            ["Duels Success", stats.duelsSuccess],
            ["Losses Own Half", stats.lossesSuccess],
            ["Recoveries", stats.recoveries]
          ];
      return ordered
        .filter(([, v]) => v != null && v !== 0)
        .map(([label, v]) => `${label}: ${v}`);
    })();
    const initials = String(displayName)
      .split(" ")
      .filter(Boolean)
      .map(n => n[0]?.toUpperCase())
      .slice(0, 2)
      .join("");

    const accent = side === "left" ? "#FF681F" : "#1b1b1b";
    const photo = coach.photo;

    return (
      <div
        style={{
          width: "100%",
          minWidth: 220,
          maxWidth: 280,
          background: "#fff",
          border: "1px solid #f1f1f1",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          alignSelf: "flex-start"
        }}
      >
        {photo ? (
          <div>
            <img
            src={photo}
            alt={displayName}
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              objectFit: "cover",
              boxShadow: "0 8px 16px rgba(0,0,0,0.12)"
            }}
          />
          </div>
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent} 0%, #ffb27a 100%)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 28,
              boxShadow: "0 8px 16px rgba(0,0,0,0.12)"
            }}
          >
            {initials || "C"}
          </div>
        )}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#777", letterSpacing: 0.5 }}>Coach</div>
          <div style={{ fontWeight: 800, color: "#111", marginTop: 4 }}>{displayName || "N/A"}</div>
        </div>
        {bestPerformer && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "#f9fafb",
              borderRadius: 12,
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #f1f1f1"
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 4 }}>
              Best Performer
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {bestPerformer.canonicalName || bestPerformer.name || bestPerformer.playerName || "N/A"}
              </div>
              <div style={{ fontSize: 12, color: "#555", marginLeft: 8, whiteSpace: "nowrap" }}>
                {bestPerformer.minutesPlayed != null ? `${bestPerformer.minutesPlayed}'` : ""}
                {bestPerformer.gameGrade != null ? ` • ${Number(bestPerformer.gameGrade).toFixed(1)}` : ""}
              </div>
            </div>
        {bestStats.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#666", lineHeight: 1.4 }}>
            {bestStats.map((line, idx) => (
              <div key={`stat-${idx}`} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <span style={{ color: accent }}>•</span>
                <span style={{ flex: 1 }}>{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

        {noteSource && noteLines.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "#fafafa",
              borderRadius: 10,
              border: "1px solid #f0f0f0",
              fontSize: 12,
              color: "#555",
              lineHeight: 1.35,
              textAlign: "left",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            {noteLines.map((line, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                <span style={{ color: accent }}>•</span>
                <span style={{ flex: 1 }}>{line}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ width: "100%", marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 6 }}>Upload GPS metrics (xls/xlsx)</div>
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={e => handleMetricsFileChange(teamKey, e.target.files?.[0] || null)}
            style={{ width: "100%" }}
          />
          <button
            onClick={() => handleMetricsUpload(teamKey)}
            disabled={!metricsFiles[teamKey] || metricsUploading[teamKey]}
            style={{
              marginTop: 8,
              width: "100%",
              background: metricsUploading[teamKey] ? "#ccc" : accent,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: metricsUploading[teamKey] ? "not-allowed" : "pointer",
              fontWeight: 700
            }}
          >
            {metricsUploading[teamKey] ? "Uploading..." : "Upload metrics"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100vw",
        background: "linear-gradient(180deg, #ffffff 0%, #f7f8fb 100%)",
        backgroundAttachment: "fixed",
        overflowX: "hidden"
      }}
    >
      <Header
        title={`${match.homeTeam} vs ${match.awayTeam}`}
        onBack={() => navigate(-1)}
        onLogout={() => navigate("/login")}
      />

      <div style={{ padding: "3vh 4vw" }}>
        <div style={{ width: "100%", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginBottom: 22
            }}
          >
            {best() && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #F3AD2C",
                  borderRadius: 12,
                  padding: "8px 14px",
                  fontWeight: 700,
                  color: "#F3AD2C",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                }}
              >
                ⭐WOTM: {best()}
              </div>
            )}
            {match.score && (
              <div
                style={{
                  background: "#1b1b1b",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "10px 16px",
                  fontWeight: 800,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)"
                }}
              >
                {match.score}
              </div>
            )}
            <div
              style={{
                background: "#fff",
                border: "1px solid #FF681F",
                borderRadius: 12,
                padding: "8px 14px",
                fontWeight: 700,
                color: "#FF681F",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
              }}
            >
              {match.date || "Match Date N/A"}
            </div>
            <button
              onClick={() => setViewMode("lineups")}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                border: viewMode === "lineups" ? "1px solid #FF681F" : "1px solid #ddd",
                background: viewMode === "lineups" ? "#fff6ee" : "#fff",
                color: "#111",
                cursor: "pointer",
                fontWeight: 700,
                boxShadow: viewMode === "lineups" ? "0 2px 8px rgba(255,104,31,0.25)" : "none"
              }}
            >
              Lineups
            </button>
            <button
              onClick={() => setViewMode("teamstats")}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                border: viewMode === "teamstats" ? "1px solid #FF681F" : "1px solid #ddd",
                background: viewMode === "teamstats" ? "#fff6ee" : "#fff",
                color: "#111",
                cursor: "pointer",
                fontWeight: 700,
                boxShadow: viewMode === "teamstats" ? "0 2px 8px rgba(255,104,31,0.25)" : "none"
              }}
            >
              Team stats
            </button>
          </div>

          {viewMode === "lineups" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr 1fr 260px",
                gap: 12,
                alignItems: "start"
              }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                {renderCoachCard(coaches.home, "left", getBestPerformer("home"), "home")}
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f1f1f1",
                  borderRadius: 20,
                  padding: 16,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minWidth: 240
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    minHeight: 46,
                    marginBottom: 12
                  }}
                >
                  <h4 style={{
                    color: "#111",
                    margin: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {match.homeTeam}
                  </h4>
                  <span style={{ fontSize: 12, color: "#999" }}>Home</span>
                </div>
                <div style={{ flex: 1 }}>
                  {renderPlayers(
                    homePlayers,
                    maxPlayed - homePlayedCount,
                    homePadAfter,
                    homePadAfterBench
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #f1f1f1",
                  borderRadius: 20,
                  padding: 16,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minWidth: 240
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    minHeight: 46,
                    marginBottom: 12
                  }}
                >
                  <h4 style={{
                    color: "#111",
                    margin: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {match.awayTeam}
                  </h4>
                  <span style={{ fontSize: 12, color: "#999" }}>Away</span>
                </div>
                <div style={{ flex: 1 }}>
                  {renderPlayers(
                    awayPlayers,
                    maxPlayed - awayPlayedCount,
                    awayPadAfter,
                    awayPadAfterBench
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                {renderCoachCard(coaches.away, "right", getBestPerformer("away"), "away")}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 260px", gap: 12, alignItems: "start" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                {renderCoachCard(coaches.home, "left", getBestPerformer("home"), "home")}
              </div>
              <div style={{ width: "100%", minWidth: 320 }}>
                {renderTeamStats()}
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                {renderCoachCard(coaches.away, "right", getBestPerformer("away"), "away")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
