const API_URL = "http://localhost:3001";

export async function getAllMatches() {
  const res = await fetch(`${API_URL}/matches`);
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json();
}

export async function getMatch(id) {
  const res = await fetch(`${API_URL}/matches/${id}`);
  if (!res.ok) throw new Error("Failed to fetch match");
  return res.json();
}

export async function uploadMatchPdf(file, metricsFile = null) {
  const formData = new FormData();
  formData.append("file", file);
  if (metricsFile) {
    formData.append("metrics", metricsFile);
  }

  const res = await fetch(`${API_URL}/matches/import-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload PDF");
  return res.json();
}

export async function uploadMatchMetrics(matchId, side, metricsFile) {
  const formData = new FormData();
  formData.append("metrics", metricsFile);
  if (side) formData.append("side", side);

  const res = await fetch(`${API_URL}/matches/${matchId}/upload-metrics`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) throw new Error("Failed to upload metrics");
  return res.json();
}
