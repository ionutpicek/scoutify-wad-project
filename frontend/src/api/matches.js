import { apiUrl } from "../config/api.js";
import { auth } from "../firebase.jsx";

async function buildAuthHeaders() {
  const token = await auth.currentUser?.getIdToken?.();
  if (!token) {
    throw new Error("Authentication required");
  }
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function getAllMatches() {
  const res = await fetch(apiUrl("/matches"));
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json();
}

export async function getMatch(id) {
  const res = await fetch(apiUrl(`/matches/${id}`));
  if (!res.ok) throw new Error("Failed to fetch match");
  return res.json();
}

export async function uploadMatchPdf(file, metricsFile = null) {
  const formData = new FormData();
  formData.append("file", file);
  if (metricsFile) {
    formData.append("metrics", metricsFile);
  }

  const headers = await buildAuthHeaders();
  const res = await fetch(apiUrl("/matches/import-pdf"), {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload PDF");
  return res.json();
}

export async function uploadMatchMetrics(matchId, side, metricsFile) {
  const formData = new FormData();
  formData.append("metrics", metricsFile);
  if (side) formData.append("side", side);

  const headers = await buildAuthHeaders();
  const res = await fetch(apiUrl(`/matches/${matchId}/upload-metrics`), {
    method: "POST",
    headers,
    body: formData
  });

  if (!res.ok) throw new Error("Failed to upload metrics");
  return res.json();
}
