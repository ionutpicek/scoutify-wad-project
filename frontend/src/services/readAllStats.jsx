import * as XLSX from "xlsx";
import { computeDerivedMetrics } from "../../../backend/src/grading/derivedMetrics";
import { detectPrimaryRole } from "../../../backend/src/grading/roleDetector";
import { searchPlayer } from "../api/players.js";
import { upsertPlayerStats } from "../api/stats.js";

const handleStatsUpload = async (file) => {
  if (!file) return;

  /* --------------------------------
   * EXTRACT PLAYER NAME
   * -------------------------------- */
  const rawName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/^Player\s*stats\s*/i, "")
    .replace(/\s*\(.*\)$/, "")
    .trim();

  if (!rawName) {
    alert("Filename does not contain a valid player name");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (event) => {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    /* --------------------------------
     * FIND PLAYER
     * -------------------------------- */
    const searchRes = await searchPlayer({ fullName: rawName });
    const player = searchRes?.player || null;
    if (!player) {
      alert("Player not found: " + rawName);
      return;
    }

    /* --------------------------------
     * FIELD MAPPING
     * -------------------------------- */
    const fieldKeyMap = {
      "Minutes played": "minutes",
      "Total actions / successful": ["totalActions", "successfulActions"],
      "Goals": "goals",
      "Assists": "assists",
      "Shots / on target": ["shots", "shotsOnTarget"],
      "xG": "xG",
      "Passes / accurate": ["passes", "accuratePasses"],
      "Long passes / accurate": ["longPasses", "longPassesAccurate"],
      "Crosses / accurate": ["crosses", "crossesAccurate"],
      "Dribbles / successful": ["dribbles", "dribblesSuccessful"],
      "Duels / won": ["duels", "duelsWon"],
      "Aerial duels / won": ["aerialDuels", "aerialDuelsWon"],
      "Interceptions": "interceptions",
      "Losses / own half": ["losses", "lossesOwnHalf"],
      "Recoveries / opp. half": ["recoveries", "recoveriesOppHalf"],
      "Defensive duels / won": ["defensiveDuels", "defensiveDuelsWon"],
      "Loose ball duels / won": ["looseBallDuels", "looseBallDuelsWon"],
      "Sliding tackles / successful": ["slidingTackles", "slidingTacklesSuccessful"],
      "Clearances": "clearances",
      "Fouls": "fouls",
      "Shot assists": "shotAssists",
      "Offensive duels / won": ["offensiveDuels", "offensiveDuelsWon"],
      "Touches in penalty area": "touchesInPenaltyArea",
      "Offsides": "offsides",
      "Progressive runs": "progressiveRuns",
      "Fouls suffered": "foulsSuffered",
      "Through passes / accurate": ["throughPasses", "throughPassesAccurate"],
      "xA": "xA",
      "Second assists": "secondAssists",
      "Passes to final third / accurate": ["passesFinalThird", "passesFinalThirdAccurate"],
      "Passes to penalty area / accurate": ["passesPenaltyArea", "passesPenaltyAreaAccurate"],
      "Received passes": "receivedPasses",
      "Forward passes / accurate": ["forwardPasses", "forwardPassesAccurate"],
      "Back passes / accurate": ["backPasses", "backPassesAccurate"]
    };

    const goalkeeperKeyMap = {
      "Minutes played": "minutes",
      "Conceded goals": "concededGoals",
      "xCG": "xCG",
      "Shots against": "shotsAgainst",
      "Saves / with reflexes": ["saves", "reflexSaves"],
      "Exits": "exits",
      "Long passes / accurate": ["longPasses", "longPassesAccurate"],
      "Goal kicks": "goalKicks",
      "Short goal kicks": "shortGoalKicks",
      "Long goal kicks": "longGoalKicks",
      "Short passes / accurate": ["passes", "accuratePasses"],
    };

    const mapping =
      ["gk", "goalkeeper"].includes(player.position?.toLowerCase())
        ? goalkeeperKeyMap
        : fieldKeyMap;

    /* --------------------------------
     * INITIAL TOTALS
     * -------------------------------- */
    let totals = {};
    Object.values(mapping).flat().forEach(k => (totals[k] = 0));
    totals.yellowCards = 0;
    totals.redCards = 0;

    totals.positions = [];
    totals.roleMinutes = {};

    /* --------------------------------
     * SPLIT FIELD HANDLER
     * -------------------------------- */
    const getSplitValues = (row, key) => {
      const val = row[key];
      if (!val) return [0, 0];

      if (typeof val === "string" && val.includes("/")) {
        return val.split("/").map(v => Number(v.trim()) || 0);
      }

      return [Number(val) || 0, 0];
    };

    const countCardMinutes = (raw) => {
      if (raw == null || raw === "") return 0;
      if (typeof raw === "number") return raw > 0 ? 1 : 0;
      const str = String(raw).trim();
      if (!str || str === "0") return 0;
      const matches = str.match(/\d+(?:\+\d+)?/g);
      if (!matches || !matches.length) return 0;
      const bases = matches.map(m => Number(m.split("+")[0]) || 0);
      if (bases.every(v => v === 0)) return 0;
      return matches.length;
    };

    // Some XLSX exports store "attempts" and "accurate" in two adjacent columns,
    // with the second column having an empty header (e.g. "", "_1", "_2").
    // This pulls the numeric value from the next column in the row when needed.
    const getAdjacentValue = (entries, indexMap, key) => {
      const idx = indexMap.get(key);
      if (idx == null) return 0;
      const next = entries[idx + 1];
      if (!next) return 0;
      const num = Number(next[1]);
      return Number.isFinite(num) ? num : 0;
    };

    /* --------------------------------
     * PROCESS ROWS
     * -------------------------------- */
    let games = 0;
    let firstGame = null;
    let lastGame = null;

    for (const row of rows) {
      games++;

      // Preserve column order so we can grab unnamed adjacent cells
      const rowEntries = Object.entries(row);
      const entryIndex = new Map();
      rowEntries.forEach(([k], i) => entryIndex.set(k, i));

      const minutesPlayed = Number(row["Minutes played"]) || 0;

      /* Dates */
      let rawDate = row["Date"];
      if (rawDate && typeof rawDate === "number") {
        rawDate = XLSX.SSF.format("yyyy-mm-dd", rawDate);
      }
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d)) {
          if (!firstGame || d < firstGame) firstGame = d;
          if (!lastGame || d > lastGame) lastGame = d;
        }
      }

      /* POSITIONS + ROLE MINUTES */
      const rawPos = row["Position"];
      if (rawPos && minutesPlayed > 0) {
        const rowPositions = rawPos.split(",").map(p => p.trim()).filter(Boolean);
        const perPosMinutes = minutesPlayed / rowPositions.length;

        rowPositions.forEach(pos => {
          totals.positions.push(pos);
          totals.roleMinutes[pos] = (totals.roleMinutes[pos] || 0) + perPosMinutes;
        });
      }

      /* SUM STATS */
      for (const excelKey in mapping) {
        const target = mapping[excelKey];

        if (Array.isArray(target)) {
          const [v1, rawV2] = getSplitValues(row, excelKey);
          const adjacent = rawV2 === 0
            ? getAdjacentValue(rowEntries, entryIndex, excelKey)
            : 0;

          const v2 = rawV2 || adjacent;

          totals[target[0]] += v1;
          totals[target[1]] += v2;
        } else {
          totals[target] += Number(row[excelKey]) || 0;
        }
      }

      const yellowCount = Number(row["Yellow cards"]) || 0;
      const redCount = Number(row["Red cards"]) || 0;
      const yellowFallback = yellowCount > 0 ? 0 : countCardMinutes(row["Yellow card"]);
      const redFallback = redCount > 0 ? 0 : countCardMinutes(row["Red card"]);
      totals.yellowCards += yellowCount || yellowFallback;
      totals.redCards += redCount || redFallback;
    }

    totals.games = games;
    if (firstGame) totals.firstGameDate = firstGame.toISOString().split("T")[0];
    if (lastGame) totals.lastGameDate = lastGame.toISOString().split("T")[0];

    /* ROUND */
    Object.keys(totals).forEach(k => {
      if (typeof totals[k] === "number") {
        totals[k] = Math.round(totals[k] * 100) / 100;
      }
    });

    const uniquePositions = Array.from(
      new Set(
        (totals.positions || [])
          .map(p => String(p).trim())
          .filter(Boolean)
      )
    );

    const roleProfile = detectPrimaryRole(uniquePositions, "GENERIC");

    totals.playerID = player.playerID;
    totals.positions = uniquePositions;
    totals.roleProfile = roleProfile;
    totals.primaryRole = roleProfile.primaryRole;
    totals.derived = computeDerivedMetrics({
      ...totals,
      primaryRole: roleProfile.primaryRole,
      positions: uniquePositions
    });

    /* --------------------------------
     * SAVE
     * -------------------------------- */
    await upsertPlayerStats(player.playerID, totals);

    alert(`Stats uploaded/updated for ${rawName}`);
  };

  reader.readAsArrayBuffer(file);
};

export default handleStatsUpload;
