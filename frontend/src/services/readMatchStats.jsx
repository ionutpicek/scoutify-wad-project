import { collection, writeBatch, increment } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { app, getDocsLogged as getDocs } from "../firebase.jsx";

const db = getFirestore(app);

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
  const [playerSnap, statsSnap] = await Promise.all([
    getDocs(collection(db, "player")),
    getDocs(collection(db, "stats"))
  ]);

  const playerByAbbr = new Map();
  playerSnap.docs.forEach(d => {
    const data = d.data();
    if (data?.abbrName) {
      playerByAbbr.set(data.abbrName.trim(), { ...data, docId: d.id });
    }
  });

  const statsByPlayerId = new Map();
  statsSnap.docs.forEach(d => {
    const data = d.data();
    if (data?.playerID) statsByPlayerId.set(data.playerID, d.ref);
  });

  return { playerByAbbr, statsByPlayerId };
};

const handleXMLUpload = (file) => {
  const reader = new FileReader();

  reader.onload = async () => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(reader.result, "text/xml");
    const instances = [...xml.getElementsByTagName("instance")];

    // Build lookup maps with two reads total
    const { playerByAbbr, statsByPlayerId } = await buildLookupMaps();

    // Accumulate increments per stats doc to batch writes
    const incrementsByStatsRef = new Map();

    const addIncrement = (ref, field) => {
      if (!ref || !field) return;
      if (!incrementsByStatsRef.has(ref.path)) {
        incrementsByStatsRef.set(ref.path, { ref, updates: {} });
      }
      const entry = incrementsByStatsRef.get(ref.path);
      if (!entry.updates[field]) entry.updates[field] = increment(1);
    };

    for (const inst of instances) {
      const eventType = inst.getElementsByTagName("text")[0]?.textContent.trim();
      const rawCode = inst.getElementsByTagName("code")[0]?.textContent.trim();
      if (!eventType || !rawCode) continue;

      // Extract player abbreviation (removes number in parentheses)
      const playerAbbr = rawCode.replace(/\(\d+\)\s*/, "").trim();
      const player = playerByAbbr.get(playerAbbr);
      if (!player) continue;

      const statsRef = statsByPlayerId.get(player.playerID);
      if (!statsRef) continue;

      const mapping = ["gk", "goalkeeper"].includes(player.position?.toLowerCase())
        ? goalkeeperMap
        : fieldMap;

      const statField = mapping[eventType];
      if (!statField) continue; // unknown event, skip

      if (Array.isArray(statField)) {
        // increment both fields
        statField.forEach(f => addIncrement(statsRef, f));
      } else {
        addIncrement(statsRef, statField);
      }
    }

    // Batch write once
    const batch = writeBatch(db);
    for (const { ref, updates } of incrementsByStatsRef.values()) {
      batch.set(ref, updates, { merge: true });
    }
    await batch.commit();

    alert("XML stats uploaded successfully!");
  };

  reader.readAsText(file);
};

export default handleXMLUpload;
