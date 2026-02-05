import { apiUrl } from "../config/api.js";

export async function getTeamPlayers(teamId) {
  const res = await fetch(apiUrl(`/players/team/${teamId}`));
  if (!res.ok) throw new Error("Failed to fetch team players");
  return res.json();
}

export async function getAllPlayers() {
  const res = await fetch(apiUrl("/players"));
  if (!res.ok) throw new Error("Failed to fetch players");
  return res.json();
}

export async function getPlayerById(id) {
  const res = await fetch(apiUrl(`/players/${id}`));
  if (!res.ok) throw new Error("Failed to fetch player");
  return res.json();
}

export async function createPlayer(payload) {
  const res = await fetch(apiUrl("/players"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create player");
  return res.json();
}

export async function updatePlayer(docId, updates) {
  const res = await fetch(apiUrl(`/players/${docId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update player");
  return res.json();
}

export async function deletePlayer(docId, playerId) {
  const query = playerId ? `?playerID=${encodeURIComponent(playerId)}` : "";
  const res = await fetch(apiUrl(`/players/${docId}${query}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete player");
  return res.json();
}

export async function searchPlayer({ fullName, teamName }) {
  const params = new URLSearchParams();
  if (fullName) params.set("fullName", fullName);
  if (teamName) params.set("teamName", teamName);
  const res = await fetch(apiUrl(`/players/search?${params.toString()}`));
  if (!res.ok) throw new Error("Failed to search player");
  return res.json();
}
