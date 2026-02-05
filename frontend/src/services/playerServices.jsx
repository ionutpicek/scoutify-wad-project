import { createPlayer, deletePlayer as deletePlayerApi, getTeamPlayers as getTeamPlayersApi, searchPlayer, updatePlayer } from "../api/players.js";

const normalizeNameForLookup = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const normalizeTeamKey = (value) =>
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
  const result = await searchPlayer({ fullName, teamName });
  if (!result?.player) return null;
  return {
    docId: result.player.id,
    ...result.player,
  };
};

/**
 * Get all players of a team
 */
export const getTeamPlayers = async (teamID) => {
  const data = await getTeamPlayersApi(teamID);
  return data.players || [];
};

/**
 * Add player + default stats
 */
export const addPlayer = async ({ name, teamID, position, photoURL, teamName, birthdate, nationality }) => {
  const result = await createPlayer({ name, teamID, position, photoURL, teamName, birthdate, nationality });
  return result?.player || null;
};

/**
 * Edit/update a player
 */
export const editPlayer = async (docID, updatedInfo) => {
  await updatePlayer(docID, updatedInfo);
};

/**
 * Delete a player + stats
 */
export const deletePlayer = async (docID, playerID) => {
  await deletePlayerApi(docID, playerID);
};
