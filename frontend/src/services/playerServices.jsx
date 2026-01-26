import { db, getDocsLogged as getDocs } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  deleteDoc,
  doc,
  setDoc
} from "firebase/firestore";

// ⚽ Collection references
const playersRef = collection(db, "player");
const statsRef = collection(db, "stats");

const normalizeNameForLookup = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const nameMatches = (candidate, target) =>
  Boolean(candidate) && normalizeNameForLookup(candidate) === target;

export const findPlayerByNameAndTeam = async ({ fullName, teamName }) => {
  if (!fullName) return null;
  const normalizedTarget = normalizeNameForLookup(fullName);
  const playerQuery = teamName
    ? query(playersRef, where("teamName", "==", teamName))
    : playersRef;

  const snapshot = await getDocs(playerQuery);
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {};
    const candidates = [data.name, data.canonicalName, data.abbrName];
    if (candidates.some((value) => nameMatches(value, normalizedTarget))) {
      return {
        docId: docSnap.id,
        ...data,
      };
    }
  }

  return null;
};

/**
 * Get all players of a team
 */
export const getTeamPlayers = async (teamID) => {
  const q = query(playersRef, where("teamID", "==", teamID));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Add player + default stats
 */
export const addPlayer = async ({ name, teamID, position, photoURL, teamName, birthdate }) => {
  const playerID = Date.now(); // unique

  // Add player document
  await addDoc(playersRef, {
    name,
    teamID,
    position,
    photoURL,
    teamName,
    birthdate,
    playerID
  });

  // Create stats based on position
  const playerStats =
    position !== "Goalkeeper"
      ? {
          playerID,
          minutes: 0,
          goals: 0,
          assists: 0,
          shots: 0,
          passes: 0,
          dribbles: 0
        }
      : {
          playerID,
          minutes: 0,
          xCG: 0,
          concededGoals: 0,
          saves: 0,
          cleanSheet: 0,
          shotAgainst: 0,
          shortGoalKicks: 0,
          longGoalKicks: 0
        };

  await addDoc(statsRef, playerStats);
};

/**
 * Edit/update a player
 */
export const editPlayer = async (docID, updatedInfo) => {
  const playerRef = doc(db, "player", docID);
  await setDoc(playerRef, updatedInfo, { merge: true });
};

/**
 * Delete a player + stats
 */
export const deletePlayer = async (docID, playerID) => {
  // delete player
  await deleteDoc(doc(db, "player", docID));

  // delete stats (using playerID search)
  const q = query(statsRef, where("playerID", "==", playerID));
  const snap = await getDocs(q);
  snap.forEach((d) => deleteDoc(doc(db, "stats", d.id)));
};
