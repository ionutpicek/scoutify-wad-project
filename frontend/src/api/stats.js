import { apiUrl } from "../config/api.js";

export async function getPlayerStatsByPlayerId(playerId) {
  const res = await fetch(apiUrl(`/stats/player/${playerId}`));
  if (!res.ok) throw new Error("Failed to fetch player stats");
  return res.json();
}

export async function getLeaderboard({ stat, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (stat) params.set("stat", stat);
  if (limit) params.set("limit", String(limit));
  const res = await fetch(apiUrl(`/stats/leaderboard?${params.toString()}`));
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

export async function upsertPlayerStats(playerId, stats) {
  const res = await fetch(apiUrl("/stats/upsert"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, stats })
  });
  if (!res.ok) throw new Error("Failed to update player stats");
  return res.json();
}

export async function incrementPlayerStats(increments) {
  const res = await fetch(apiUrl("/stats/increment"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ increments })
  });
  if (!res.ok) throw new Error("Failed to increment player stats");
  return res.json();
}
