import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../components/Header.jsx";
import Spinner from "../../components/Spinner.jsx";
import { getMatch, uploadMatchMetrics } from "../../api/matches";
import { db, getDocLogged as getDoc } from "../../firebase";
import { doc } from "firebase/firestore";
import { getCurrentUser } from "../../services/sessionStorage.js";
import { buildAllPlayerMatchReports, buildPlayerMatchReport } from "../../utils/playerMatchReport.js";

const DEFAULT_VIEW_MODES = [
  { id: "lineups", label: "Lineups" },
  { id: "teamstats", label: "Team stats" },
  { id: "coaches", label: "Performers" }
];

const gradeChip = (grade, delta) => {
  const numGrade = grade == null ? null : Number(grade);
  const deltaNum = Number.isFinite(Number(delta)) ? Number(delta) : null;
  const positive = deltaNum != null && deltaNum > 0;
  const negative = deltaNum != null && deltaNum < 0;
  const primaryColor = positive ? "#0b8a42" : negative ? "#c62828" : "#2c2c2c";
  const badgeBg = positive ? "#e6f4ea" : negative ? "#fdecea" : "#f4f4f4";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2vh" }}>
      <span style={{ color: primaryColor, fontWeight: 800, fontSize: "1rem" }}>
        {numGrade != null ? numGrade.toFixed(1) : "-"}
      </span>
      {deltaNum != null && (
        <span
          style={{
            color: primaryColor,
            background: badgeBg,
            padding: "0.2vh 0.6vw",
            borderRadius: 999,
            fontSize: "0.65rem",
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

const buildLineupSegments = (list) => {
  const played = list.filter((p) => Number(p.minutesPlayed || 0) > 0);
  let starters = played.filter((p) => p.starter);
  let subsPlayed = played.filter((p) => !p.starter);
  if (starters.length === 0 && played.length > 0) {
    const sorted = [...played].sort((a, b) => Number(b.minutesPlayed || 0) - Number(a.minutesPlayed || 0));
    starters = sorted.slice(0, 11);
    subsPlayed = sorted.slice(11);
  } else if (starters.length > 11) {
    const sortedStarters = [...starters].sort((a, b) => Number(b.minutesPlayed || 0) - Number(a.minutesPlayed || 0));
    starters = sortedStarters.slice(0, 11);
    subsPlayed = [...subsPlayed, ...sortedStarters.slice(11)];
  }
  return {
    starters,
    subsPlayed
  };
};

const renderPlayerCell = (player) => {
  if (!player) {
    return (
      <div style={pairedCellEmpty}>
        <span style={pairedNameStyle}>—</span>
      </div>
    );
  }

  const gradeValue = player.grade ?? player.gameGrade?.overall10;
  const seasonGradeValue = player.seasonGrade != null ? Number(player.seasonGrade) : null;
  const computedDelta =
    player.delta != null
      ? Number(player.delta)
      : gradeValue != null && seasonGradeValue != null
        ? Number(gradeValue) - seasonGradeValue
        : null;

  return (
    <div style={pairedCell}>
      <div style={pairedCellText}>
        <span style={pairedNameStyle}>
          {player.number != null ? `${player.number}. ` : ""}
          {player.canonicalName || player.name}
        </span>
        <span style={pairedMetaStyle}>
          {(player.position || "-").toUpperCase()} • {player.minutesPlayed ?? 0}'
        </span>
      </div>
      <div style={pairedCellGrade}>{gradeChip(gradeValue, computedDelta)}</div>
    </div>
  );
};

const renderPairedRows = (homeList, awayList) => {
  const maxLen = Math.max(homeList.length, awayList.length);
  return Array.from({ length: maxLen }).map((_, idx) => (
    <div key={`paired-row-${idx}`} style={pairedRow}>
      {renderPlayerCell(homeList[idx])}
      <div style={pairedRowCenter}></div>
      {renderPlayerCell(awayList[idx])}
    </div>
  ));
};

const renderLineupSegment = (homeList, awayList, centerLabel, homeTitle, awayTitle) => {
  if (homeList.length === 0 && awayList.length === 0) return null;
  return (
    <div style={pairedSegment}>
      <div style={pairedSegmentHeader}>
        <span style={pairedSegmentName}>{homeTitle}</span>
        <span style={pairedSegmentLabel}>{centerLabel}</span>
        <span style={pairedSegmentNameRight}>{awayTitle}</span>
      </div>
      {renderPairedRows(homeList, awayList)}
    </div>
  );
};

export default function MatchPageMobile() {
  const coachCache = React.useRef(new Map());
  const { id } = useParams();
  const navigate = useNavigate();
  const storedUser = React.useMemo(() => getCurrentUser(), []);
  const userRole = String(storedUser?.role || "").toLowerCase();
  const isPlayerRole = userRole === "player";
  const isAdminRole = userRole === "admin";
  const canUploadMetrics = !isPlayerRole;
  const viewModes = isPlayerRole
    ? [
        { id: "playerreport", label: "My report" },
        { id: "lineups", label: "Lineups" },
        { id: "teamstats", label: "Team stats" },
        { id: "coaches", label: "Performers" }
      ]
    : isAdminRole
      ? [{ id: "allreports", label: "All reports" }, ...DEFAULT_VIEW_MODES]
      : DEFAULT_VIEW_MODES;
  const [match, setMatch] = useState(null);
  const [viewMode, setViewMode] = useState(isPlayerRole ? "playerreport" : "lineups");
  const [coaches, setCoaches] = useState({ home: {}, away: {} });
  const [metricsFiles, setMetricsFiles] = useState({ home: null, away: null });
  const [metricsUploading, setMetricsUploading] = useState({ home: false, away: false });

  useEffect(() => {
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
    return () => {
      document.body.style.overflowX = "auto";
      document.documentElement.style.overflowX = "auto";
    };
  }, []);

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
  }, [id]);

  const handleMetricsFileChange = (sideKey, fileObj) => {
    setMetricsFiles((prev) => ({ ...prev, [sideKey]: fileObj || null }));
  };

  const handleMetricsUpload = async (sideKey) => {
    const file = metricsFiles[sideKey];
    if (!file) return;
    setMetricsUploading((prev) => ({ ...prev, [sideKey]: true }));
    try {
      await uploadMatchMetrics(id, sideKey, file);
      await loadMatch();
      setMetricsFiles((prev) => ({ ...prev, [sideKey]: null }));
    } catch (e) {
      console.error(e);
      alert("Metrics upload failed");
    } finally {
      setMetricsUploading((prev) => ({ ...prev, [sideKey]: false }));
    }
  };

  const best = () => {
    const pool = match?.bestPerformers || match?.bestPerformer || {};
    const home = pool.home;
    const away = pool.away;
    if (!home && !away) return null;
    const score = (p) => {
      if (!p) return -Infinity;
      const grade = Number(p.gameGrade ?? p.grade ?? 0);
      const impact = Number(p.impactScore ?? 0);
      return grade * 10 + impact;
    };
    const winner = score(home) >= score(away) ? home : away;
    if (!winner) return null;
    const grade = winner.gameGrade ?? winner.grade;
    return `${winner.name || winner.canonicalName || winner.playerName || "N/A"}${
      grade != null ? " " + Number(grade).toFixed(1) : ""
    }`;
  };

  const players = Array.isArray(match?.players) ? match.players : [];
  const playerReport = React.useMemo(() => {
    if (!isPlayerRole) return null;
    return buildPlayerMatchReport(players, storedUser);
  }, [isPlayerRole, players, storedUser]);
  const allPlayerReports = React.useMemo(() => {
    if (!isAdminRole) return [];
    return buildAllPlayerMatchReports(players);
  }, [isAdminRole, players]);

  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s.]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const homeTeamIdFromPlayers =
    players.find((p) => p.team === "home" && (p.teamId || p.teamID))?.teamId ||
    players.find((p) => p.team === "home" && (p.teamId || p.teamID))?.teamID;
  const awayTeamIdFromPlayers =
    players.find((p) => p.team === "away" && (p.teamId || p.teamID))?.teamId ||
    players.find((p) => p.team === "away" && (p.teamId || p.teamID))?.teamID;

  const sortPlayers = (list) => {
    const group = (pos) => {
      const p = String(pos || "").toUpperCase();
      if (p === "GK") return 0;
      if (p.includes("B")) return 1;
      if (p.includes("M")) return 2;
      return 3;
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
      (p) =>
        String(p.teamId || p.teamID) === String(match?.homeTeamId || match?.hometeamID) ||
        p.team === "home"
    )
  );

  const awayPlayers = sortPlayers(
    players.filter(
      (p) =>
        String(p.teamId || p.teamID) === String(match?.awayTeamId || match?.awayteamID) ||
        p.team === "away"
    )
  );

  const homeLineup = buildLineupSegments(homePlayers);
  const awayLineup = buildLineupSegments(awayPlayers);

  useEffect(() => {
    const loadCoaches = async () => {
      if (!match) return;
      const fetchCoach = async (teamId, fallbackName) => {
        if (!teamId) return {};
        const cleanName = fallbackName ? String(fallbackName).trim() : null;
        const buildCoach = (data) => ({
          name: data?.coach || data?.coachName || cleanName || null,
          photo: data?.coachURL || data?.coachUrl || null
        });
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
        fetchCoach(match?.homeTeamId || match?.hometeamID || homeTeamIdFromPlayers, match?.homeTeam),
        fetchCoach(match?.awayTeamId || match?.awayteamID || awayTeamIdFromPlayers, match?.awayTeam)
      ]);
      setCoaches({ home: homeCoach, away: awayCoach });
    };
    loadCoaches();
  }, [match, homeTeamIdFromPlayers, awayTeamIdFromPlayers]);

  const renderCoachCard = (coach = {}, bestPerformer = null, teamKey = "home") => {
    const displayName = coach.name || "Coach";
    const noteSource = match?.gpsMetrics ? match.gpsMetrics[teamKey] : "";
    const noteLines = (noteSource || "")
      .split(" | ")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        const lower = line.toLowerCase();
        if (lower.includes("grade")) return false;
        if (lower.startsWith("score")) return false;
        if (lower.includes("goals:")) return false;
        return true;
      });

    const bestStats = (() => {
      if (!bestPerformer) return [];
      const target = players.find((p) => {
        if (bestPerformer.playerId && p.playerId === bestPerformer.playerId) return true;
        const bpName = normalize(bestPerformer.canonicalName || bestPerformer.name || bestPerformer.playerName);
        const playerName = normalize(p.canonicalName || p.name);
        return bpName && playerName && bpName === playerName;
      });
      const stats = target?.matchStats || {};
      const isGK =
        (target?.position || "").toUpperCase() === "GK" ||
        (target?.rolePlayed || "").toUpperCase() === "GK";
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
      .map((n) => n[0]?.toUpperCase())
      .slice(0, 2)
      .join("");

    const accent = teamKey === "home" ? "#FF681F" : "#1b1b1b";
    const photo = coach.photo;

    return (
      <div style={coachCardStyle}>
        {photo ? (
          <img src={photo} alt={displayName} style={coachPhotoStyle} />
        ) : (
          <div style={{ ...coachPhotoStyle, ...coachInitialsWrap, background: `linear-gradient(135deg, ${accent}, #ffb27a)` }}>
            <span>{initials || "C"}</span>
          </div>
        )}
        <div style={coachNameWrap}>
          <span style={coachLabel}>Coach</span>
          <strong style={coachName}>{displayName}</strong>
        </div>

        {bestPerformer && (
          <div style={coachBestWrapper}>
            <div style={coachBestTitle}>Best Performer</div>
            <div style={coachBestLine}>
              <span>{bestPerformer.name || bestPerformer.canonicalName || "N/A"}</span>
              <span>{bestPerformer.minutesPlayed ? `${bestPerformer.minutesPlayed}'` : ""}</span>
            </div>
            <div style={coachBestStats}>
              {bestStats.map((line, idx) => (
                <div key={`stat-${idx}`} style={coachBestStatLine}>
                  <span style={{ color: accent }}>•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {noteLines.length > 0 && (
          <div style={coachNotesWrap}>
            {noteLines.map((line, idx) => (
              <div key={`note-${idx}`} style={coachBestStatLine}>
                <span style={{ color: accent }}>•</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        )}

        {canUploadMetrics && (
          <div style={{ width: "100%" }}>
            <div style={coachMetricsLabel}>Upload GPS metrics (xls/xlsx)</div>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => handleMetricsFileChange(teamKey, e.target.files?.[0] || null)}
              style={{ width: "100%" }}
            />
            <button
              onClick={() => handleMetricsUpload(teamKey)}
              disabled={!metricsFiles[teamKey] || metricsUploading[teamKey]}
              style={{
                marginTop: "1vh",
                width: "100%",
                background: metricsUploading[teamKey] ? "#ccc" : accent,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "2vh 0",
                cursor: metricsUploading[teamKey] ? "not-allowed" : "pointer",
                fontWeight: 700
              }}
            >
              {metricsUploading[teamKey] ? "Uploading..." : "Upload metrics"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTeamStats = () => {
    const ts = match?.teamStats || {};
    const home = ts.home || {};
    const away = ts.away || {};
    const rows = [
      { label: "xG", key: "xG", fmt: (v) => v.toFixed(2) },
      { label: "Possession %", key: "possessionPct", fmt: (v) => `${v}%` },
      { label: "Shots", key: "shots" },
      { label: "Shots on target", key: "shotsOnTarget" },
      { label: "Corners", key: "corners" },
      { label: "Passes", key: "passes" },
      { label: "Passes accurate", key: "passesAccurate" },
      {
        label: "Pass accuracy %",
        key: "passAccuracyPct",
        compute: () => ({
          home: home.passesAccurate != null && home.passes ? (home.passesAccurate / home.passes) * 100 : null,
          away: away.passesAccurate != null && away.passes ? (away.passesAccurate / away.passes) * 100 : null
        }),
        fmt: (v) => `${v.toFixed(1)}%`
      },
      { label: "Long pass share %", key: "longPassSharePct", fmt: (v) => `${v}%` },
      { label: "Duels", key: "duels" },
      { label: "Duels won", key: "duelsWon" },
      { label: "Recoveries", key: "recoveries" },
      { label: "Fouls", key: "fouls" },
      {
        label: "Yellow / Red",
        key: "cards",
        compute: () => ({
          home:
            home.yellow != null || home.red != null ? `${home.yellow ?? 0}/${home.red ?? 0}` : null,
          away:
            away.yellow != null || away.red != null ? `${away.yellow ?? 0}/${away.red ?? 0}` : null
        })
      },
      { label: "PPDA", key: "ppda", fmt: (v) => v.toFixed(2) },
      {
        label: "Possession time",
        key: "purePossessionSec",
        fmt: (v) => {
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
        fmt: (v) => {
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
        fmt: (v) => {
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
      .map((row) => {
        if (row.compute) {
          const res = row.compute(home, away);
          return { ...row, homeVal: res.home, awayVal: res.away };
        }
        return { ...row, homeVal: home[row.key], awayVal: away[row.key] };
      })
      .filter((r) => r.homeVal != null || r.awayVal != null);

    if (!displayRows.length) {
      return (
        <div style={noDataStyle}>
          Team stats not available for this match.
        </div>
      );
    }

    return (
      <div style={teamStatsCard}>
        {displayRows.map((row, idx) => {
          const fmt = row.fmt || ((v) => v);
          return (
            <div key={`ts-${idx}-${row.label}`} style={teamStatsRow}>
              <span style={teamStatsValue}>{row.homeVal != null ? fmt(row.homeVal) : "-"}</span>
              <span style={teamStatsLabel}>{row.label}</span>
              <span style={teamStatsValueRight}>{row.awayVal != null ? fmt(row.awayVal) : "-"}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPlayerReportCard = (report, options = {}) => {
    if (!report?.entry) return null;

    const entry = report.entry;
    const grade = report.grade;
    const statsRows = report.statsRows;
    const title = options.title || entry.canonicalName || entry.name || "Player report";
    const teamText =
      entry.team === "home" ? match?.homeTeam || "Home" : entry.team === "away" ? match?.awayTeam || "Away" : null;
    const cleanSignalLabel = label =>
      String(label || "")
        .replace(/\s*\/90\b/gi, "")
        .replace(/\s*p90\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    const formatSignal = item =>
      `${cleanSignalLabel(item.label)}${item.raw && item.raw.includes("%") ? ` (${item.raw})` : ""}`;

    return (
      <div style={playerReportWrap}>
        <div style={playerReportHeader}>
          <div>
            <div style={playerReportName}>{title}</div>
            <div style={playerReportMeta}>
              {(entry.position || entry.rolePlayed || "-").toUpperCase()} | {entry.minutesPlayed ?? 0}' played
              {teamText ? ` | ${teamText}` : ""}
            </div>
          </div>
          <div style={playerGradeBadge}>
            {grade.overall10 != null ? `${grade.overall10.toFixed(1)} / 10` : "No grade"}
          </div>
        </div>

        <div style={playerExplanationCard}>
          <div style={playerSectionTitle}>Grade explanation</div>
          <div style={playerSummaryText}>{grade.summary}</div>
          {grade.cardPenalty != null && (
            <div style={playerPenaltyText}>Discipline impact: -{grade.cardPenalty} points.</div>
          )}

          {grade.hasBreakdown ? (
            <>
              {grade.strengths.length > 0 && (
                <div style={playerStrengthText}>
                  Strength drivers:{" "}
                  {grade.strengths.map(item => formatSignal(item)).join(", ")}
                  .
                </div>
              )}
              {grade.improvements.length > 0 && (
                <div style={playerImproveText}>
                  Improvement areas:{" "}
                  {grade.improvements.map(item => formatSignal(item)).join(", ")}
                  .
                </div>
              )}
            </>
          ) : (
            grade.fallbackInsights.length > 0 && (
              <ul style={playerInsightList}>
                {grade.fallbackInsights.map((line, index) => (
                  <li key={`insight-${index}`}>{line}</li>
                ))}
              </ul>
            )
          )}
        </div>

        <div style={playerStatsSection}>
          <div style={playerSectionTitle}>Match stats</div>
          {statsRows.length ? (
            <div style={playerStatsGrid}>
              {statsRows.map(stat => (
                <div key={stat.key} style={playerStatCard}>
                  <div style={playerStatLabel}>{stat.label}</div>
                  <div style={playerStatValue}>{stat.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={playerSummaryText}>No tracked player stats found for this match.</div>
          )}
        </div>
      </div>
    );
  };

  const renderPlayerReport = () => {
    if (!isPlayerRole) {
      return <div style={noDataStyle}>Player report is available only for player accounts.</div>;
    }

    if (!playerReport?.entry) {
      return <div style={noDataStyle}>Your player profile was not found in this match lineup.</div>;
    }

    return renderPlayerReportCard(playerReport, { title: playerReport.entry?.canonicalName || "My report" });
  };

  const renderAllPlayerReports = () => {
    if (!isAdminRole) {
      return <div style={noDataStyle}>All player reports are available only for admin accounts.</div>;
    }
    if (!allPlayerReports.length) {
      return <div style={noDataStyle}>No player reports available for this match.</div>;
    }

    const homeReports = allPlayerReports.filter(r => r?.entry?.team === "home");
    const awayReports = allPlayerReports.filter(r => r?.entry?.team === "away");
    const otherReports = allPlayerReports.filter(r => !["home", "away"].includes(String(r?.entry?.team || "")));

    const renderSection = (label, reports) => {
      if (!reports.length) return null;
      return (
        <div style={allReportsSection}>
          <div style={allReportsTitle}>{label}</div>
          <div style={allReportsList}>
            {reports.map(report => (
              <div key={`admin-report-${report.entry.playerId || report.entry.name}`}>
                {renderPlayerReportCard(report)}
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div style={sectionStack}>
        {renderSection(`${match?.homeTeam || "Home"} reports (${homeReports.length})`, homeReports)}
        {renderSection(`${match?.awayTeam || "Away"} reports (${awayReports.length})`, awayReports)}
        {renderSection(`Other reports (${otherReports.length})`, otherReports)}
      </div>
    );
  };

  const getBestPerformer = (side) => {
    const pool = match?.bestPerformers || match?.bestPerformer || {};
    return pool?.[side] || null;
  };

  if (!match) {
    return (
      <div style={shellStyle}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <Header
        title={`Match Stats`}
        subtitle={`${match?.homeTeam} vs ${match?.awayTeam}`  }
        onBack={() => navigate(-1)}
        onLogout={() => navigate("/login")}
      />

      <div style={contentStyle}>
        <div style={summaryRow}>
          <div style={{display:"flex", gap:10, flexWrap:"center", justifyContent:"center", }}>
            {best() && <div style={bestBadge}>⭐ WOTM: {best()}</div>}
            {match.score && <div style={scoreBadge}>{match.score}</div>}
            <div style={dateBadge}>{match.date || "Match Date N/A"}</div>
          </div>          
        </div>

        <div style={viewToggleRow}>
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
              style={{
                ...viewToggleBtn,
                ...(viewMode === mode.id ? viewToggleBtnActive : {})
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {viewMode === "playerreport" && (
          <div style={sectionStack}>{renderPlayerReport()}</div>
        )}
        {viewMode === "allreports" && (
          <div style={sectionStack}>{renderAllPlayerReports()}</div>
        )}

        {viewMode === "lineups" && (
          <div>
            <div style={lineupsHeader}>
              <span>{match.homeTeam}</span>
              <span style={lineupsSpacer} />
              <span style={lineupsHeaderRight}>{match.awayTeam}</span>
            </div>
            <div style={pairedStack}>
              {renderLineupSegment(
                homeLineup.starters,
                awayLineup.starters,
                "Starters",
                "",
                ""
              )}
              {(homeLineup.subsPlayed.length > 0 || awayLineup.subsPlayed.length > 0) &&
                renderLineupSegment(
                  homeLineup.subsPlayed,
                  awayLineup.subsPlayed,
                  "Substitutes (played)",
                  "",
                  ""
                )}
            </div>
          </div>
        )}

        {viewMode === "teamstats" && (
          <div style={sectionStack}>
            <div style={lineupsHeader}>
              <span>{match.homeTeam}</span>
              <span style={lineupsSpacer} />
              <span style={lineupsHeaderRight}>{match.awayTeam}</span>
            </div>
            {renderTeamStats()}
          </div>
        )}

        {viewMode === "coaches" && (
          <div style={sectionStack}>
            <div style={coachGrid}>
              {renderCoachCard(coaches.home, getBestPerformer("home"), "home")}
              {renderCoachCard(coaches.away, getBestPerformer("away"), "away")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const shellStyle = {
  minHeight: "100vh",
  width: "100vw",
  background: "linear-gradient(180deg, #ffffff 0%, #f7f8fb 100%)",
  overflowX: "hidden"
};

const contentStyle = {
  padding: "3vh 5vw",
  display: "flex",
  flexDirection: "column",
  gap: "3vh"
};

const summaryRow = {
  display: "flex",
  flexDirection: "column",
  gap: "1vh"
};

const bestBadge = {
  alignSelf: "flex-start",
  background: "#fff",
  border: "1px solid #F3AD2C",
  borderRadius: 12,
  padding: "1vh 2vw",
  fontWeight: 700,
  color: "#F3AD2C"
};

const scoreBadge = {
  alignSelf: "flex-start",
  background: "#1b1b1b",
  color: "#fff",
  borderRadius: 12,
  padding: "1vh 2vw",
  fontWeight: 800
};

const dateBadge = {
  alignSelf: "flex-start",
  background: "#fff",
  border: "1px solid #FF681F",
  borderRadius: 12,
  padding: "1vh 2vw",
  fontWeight: 700,
  color: "#FF681F"
};

const viewToggleRow = {
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: "2vw"
};

const viewToggleBtn = {
  borderRadius: 999,
  color: "#333",
  border: "1px solid #ddd",
  background: "#fff",
  fontWeight: 700,
  padding: "1vh 3vw",
  cursor: "pointer"
};

const viewToggleBtnActive = {
  borderColor: "#FF681F",
  background: "#fff1ee",
  boxShadow: "0 4px 12px rgba(255,104,31,0.25)"
};

const sectionStack = {
  display: "flex",
  flexDirection: "column",
  gap: "2vh"
};

const pairedStack = {
  display: "flex",
  flexDirection: "column",
  gap: "2vh"
};

const pairedSegment = {
  background: "#fff",
  borderRadius: 16,
  padding: "2vh 2vw",
  border: "1px solid #f1f1f1",
  boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
  display: "flex",
  flexDirection: "column",
  gap: "1vh"
};

const pairedSegmentLabel = {
  fontWeight: 700,
  fontSize: "0.95rem",
  color: "#444"
};

const lineupsHeader = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  marginBottom: "1vh"
};

const lineupsSpacer = {
  width: "30px"
};

const lineupsHeaderRight = {
  textAlign: "right"
};

const pairedSegmentHeader = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  gap: "1vw",
  alignItems: "center"
};

const pairedSegmentName = {
  fontWeight: 700,
  fontSize: "1rem",
  color: "#111"
};

const pairedSegmentNameRight = {
  ...pairedSegmentName,
  textAlign: "right"
};

const pairedRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  padding: "1vh 0",
  gap: "2vw",
  borderBottom: "1px solid #f3f3f3"
};

const pairedRowCenter = {
  width: "4vw",
  fontSize: "0.7rem",
  color: "#999",
  textAlign: "center"
};

const pairedCell = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1vw",
  minWidth: 0
};

const pairedCellEmpty = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ccc",
  fontWeight: 600
};

const pairedNameStyle = {
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const pairedMetaStyle = {
  fontSize: "0.75rem",
  color: "#666",
  whiteSpace: "nowrap"
};

const pairedCellText = {
  display: "flex",
  flexDirection: "column",
  gap: "0.2vh",
  minWidth: 0
};

const pairedCellGrade = {
  minWidth: "70px",
  display: "flex",
  justifyContent: "flex-end"
};

const teamStatsCard = {
  background: "#fff",
  borderRadius: 24,
  padding: "2vh 2vw",
  border: "1px solid #f1f1f1",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
};

const teamStatsRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  alignItems: "center",
  padding: "1vh 0",
  borderBottom: "1px solid #f5f5f5"
};

const teamStatsLabel = {
  textAlign: "center",
  fontSize: "0.85rem",
  color: "#555",
  fontWeight: 600
};

const teamStatsValue = {
  textAlign: "left",
  fontWeight: 700,
  color: "#111"
};

const teamStatsValueRight = {
  textAlign: "right",
  fontWeight: 700,
  color: "#111"
};

const noDataStyle = {
  padding: "2vh",
  textAlign: "center",
  color: "#666",
  background: "#fff",
  borderRadius: 16
};

const playerReportWrap = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #f1f1f1",
  padding: "2vh 3vw",
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "1.6vh"
};

const playerReportHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "2vw"
};

const playerReportName = {
  fontSize: "1.05rem",
  fontWeight: 800,
  color: "#111"
};

const playerReportMeta = {
  marginTop: "0.4vh",
  fontSize: "0.78rem",
  color: "#666"
};

const playerGradeBadge = {
  borderRadius: 12,
  border: "1px solid #FF681F",
  background: "#fff8f2",
  color: "#FF681F",
  fontWeight: 800,
  padding: "0.8vh 2.8vw",
  whiteSpace: "nowrap"
};

const playerExplanationCard = {
  borderRadius: 12,
  border: "1px solid #f0e2d7",
  background: "#fffaf6",
  padding: "1.4vh 2.4vw",
  display: "flex",
  flexDirection: "column",
  gap: "0.7vh"
};

const playerStatsSection = {
  display: "flex",
  flexDirection: "column",
  gap: "0.8vh"
};

const playerSectionTitle = {
  fontSize: "0.82rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#333"
};

const playerSummaryText = {
  fontSize: "0.86rem",
  lineHeight: 1.45,
  color: "#444"
};

const playerPenaltyText = {
  fontSize: "0.82rem",
  fontWeight: 700,
  color: "#b45309"
};

const playerStrengthText = {
  fontSize: "0.82rem",
  lineHeight: 1.45,
  color: "#14532d"
};

const playerImproveText = {
  fontSize: "0.82rem",
  lineHeight: 1.45,
  color: "#7f1d1d"
};

const playerInsightList = {
  margin: 0,
  paddingLeft: 18,
  color: "#444",
  display: "flex",
  flexDirection: "column",
  gap: "0.4vh",
  fontSize: "0.82rem"
};

const playerStatsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "1vh 2vw"
};

const playerStatCard = {
  borderRadius: 12,
  border: "1px solid #f1f1f1",
  background: "#fff",
  padding: "1vh 2vw"
};

const playerStatLabel = {
  fontSize: "0.72rem",
  color: "#666"
};

const playerStatValue = {
  marginTop: "0.2vh",
  fontWeight: 800,
  color: "#111"
};

const allReportsSection = {
  display: "flex",
  flexDirection: "column",
  gap: "1vh"
};

const allReportsTitle = {
  fontSize: "0.95rem",
  fontWeight: 800,
  color: "#222"
};

const allReportsList = {
  display: "flex",
  flexDirection: "column",
  gap: "1vh"
};

const coachGrid = {
  display: "flex",
  flexDirection: "column",
  gap: "2vh"
};

const coachCardStyle = {
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #f1f1f1",
  padding: "2vh 2vw",
  boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "1vh"
};

const coachPhotoStyle = {
  width: 96,
  height: 96,
  borderRadius: "50%",
  objectFit: "cover",
  alignSelf: "center",
  boxShadow: "0 8px 16px rgba(0,0,0,0.1)"
};

const coachInitialsWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 800,
  fontSize: "1.5rem"
};

const coachNameWrap = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.2vh"
};

const coachLabel = {
  fontSize: "0.7rem",
  letterSpacing: 0.5,
  color: "#777"
};

const coachName = {
  fontSize: "1rem",
  fontWeight: 800,
  color: "#111"
};

const coachBestWrapper = {
  background: "#fbfbfb",
  borderRadius: 12,
  padding: "1vh 1vw",
  border: "1px solid #f2f2f2"
};

const coachBestTitle = {
  fontSize: "0.75rem",
  color: "#666",
  marginBottom: "0.3vh",
  fontWeight: 700
};

const coachBestLine = {
  display: "flex",
  justifyContent: "space-between",
  fontWeight: 700,
  marginBottom: "0.5vh"
};

const coachBestStats = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5vh",
  fontSize: "0.8rem",
  color: "#444"
};

const coachBestStatLine = {
  display: "flex",
  gap: "0.4vw",
  alignItems: "flex-start"
};

const coachNotesWrap = {
  background: "#fff",
  borderRadius: 12,
  padding: "1.2vh 1vw",
  border: "1px solid #f2f2f2",
  fontSize: "0.8rem",
  color: "#444",
  display: "flex",
  flexDirection: "column",
  gap: "0.4vh"
};

const coachMetricsLabel = {
  fontSize: "0.75rem",
  color: "#777",
  marginBottom: "0.4vh"
};
