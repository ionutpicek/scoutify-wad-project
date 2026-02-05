import { getAllPlayers } from "../api/players.js";
import { incrementPlayerStats } from "../api/stats.js";

const fieldMap = {
  // FIELD PLAYERS
  "Passes": "passes",
  "Long-range passes": "longPasses",
  "Through passes": "passes",
  "Cross": "crosses",
  "Shots": ["shotsOnTarget", "shots"],
  "Shot off target": "shots",
  "Opportunity": "totalActions",
  "Goal - Left Foot": "goals",
  "Goal - Right Foot": "goals",
  "Attacking duels": ["duels", "duelsWon"],
  "Defending duels": ["duels", "duelsWon"],
  "Loose ball duel": "duels",
  "Aerial duels": "aerialDuels",
  "1VS1 and dribbling": "dribbling",
  "1 vs 1 Defense": "defensive1v1",
  "Interceptions": "interceptions",
  "Clearances": "clearances",
  "Recovery": "recoveries",
  "Under pressure": "underPressure",
  "Distributions": "distributions",
  "Offsides": "offsides",
  "Winning fouls": "winningFouls"
};

const goalkeeperMap = {
  // GOALKEEPER EVENTS
  "Shot off target": "shotsOffTarget",
  "Distributions": "distributions",
  "Interceptions": "interceptions",
  "Recovery": "recoveries",
  "1 vs 1 Defense": "defensive1v1",
  "Reflexes": "reflexes"
};

const buildLookupMaps = async () => {
  // One-time reads: all players + all stats, then join by playerID
  const response = await getAllPlayers();
  const players = response?.players || [];
  const playerByAbbr = new Map();
  players.forEach(p => {
    if (p?.abbrName) {
      playerByAbbr.set(String(p.abbrName).trim(), p);
    }
  });

  return { playerByAbbr };
};

const handleXMLUpload = (file) => {
  const reader = new FileReader();

  reader.onload = async () => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(reader.result, "text/xml");
    const instances = [...xml.getElementsByTagName("instance")];

    // Build lookup maps with two reads total
    const { playerByAbbr } = await buildLookupMaps();

    // Accumulate increments per stats doc to batch writes
    const incrementsByPlayerId = new Map();

    const addIncrement = (playerId, field) => {
      if (!playerId || !field) return;
      if (!incrementsByPlayerId.has(playerId)) {
        incrementsByPlayerId.set(playerId, {});
      }
      const entry = incrementsByPlayerId.get(playerId);
      entry[field] = (entry[field] || 0) + 1;
    };

    for (const inst of instances) {
      const eventType = inst.getElementsByTagName("text")[0]?.textContent.trim();
      const rawCode = inst.getElementsByTagName("code")[0]?.textContent.trim();
      if (!eventType || !rawCode) continue;

      // Extract player abbreviation (removes number in parentheses)
      const playerAbbr = rawCode.replace(/\(\d+\)\s*/, "").trim();
      const player = playerByAbbr.get(playerAbbr);
      if (!player) continue;

      const mapping = ["gk", "goalkeeper"].includes(player.position?.toLowerCase())
        ? goalkeeperMap
        : fieldMap;

      const statField = mapping[eventType];
      if (!statField) continue; // unknown event, skip

      if (Array.isArray(statField)) {
        // increment both fields
        statField.forEach(f => addIncrement(player.playerID, f));
      } else {
        addIncrement(player.playerID, statField);
      }
    }

    const increments = Array.from(incrementsByPlayerId.entries()).map(
      ([playerId, deltas]) => ({ playerId, deltas })
    );

    if (increments.length) {
      await incrementPlayerStats(increments);
    }

    alert("XML stats uploaded successfully!");
  };

  reader.readAsText(file);
};

export default handleXMLUpload;
