import { apiUrl } from "../config/api.js";

export async function getTeams() {
  const res = await fetch(apiUrl("/teams"));
  if (!res.ok) throw new Error("Failed to fetch teams");
  return res.json();
}

export async function getTeamById(teamId) {
  const res = await fetch(apiUrl(`/teams/${teamId}`));
  if (!res.ok) throw new Error("Failed to fetch team");
  return res.json();
}

export async function createTeam(payload) {
  const res = await fetch(apiUrl("/teams"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create team");
  return res.json();
}

export async function updateTeam(teamId, updates) {
  const res = await fetch(apiUrl(`/teams/${teamId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update team");
  return res.json();
}

export async function deleteTeam(teamId) {
  const res = await fetch(apiUrl(`/teams/${teamId}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete team");
  return res.json();
}
