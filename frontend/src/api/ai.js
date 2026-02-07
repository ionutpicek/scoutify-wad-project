import { apiUrl } from "../config/api.js";

export async function getTeamStyleSummary(teamId, { regenerate = false } = {}) {
  if (!teamId) throw new Error("teamId is required");

  const response = await fetch(apiUrl(`/ai/team-style/${teamId}?regenerate=${regenerate ? "1" : "0"}`));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      payload?.error || "Failed to load team style summary.";
    throw new Error(message);
  }

  return response.json();
}

export async function regenerateTeamStyleSummary(teamId) {
  if (!teamId) throw new Error("teamId is required");

  const response = await fetch(apiUrl(`/ai/team-style/${teamId}/regenerate`), {
    method: "POST",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Failed to regenerate team style summary.";
    throw new Error(message);
  }

  return response.json();
}

export async function getTeamReport(teamId) {
  if (!teamId) throw new Error("teamId is required");

  const response = await fetch(apiUrl(`/ai/team-report/${teamId}`));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Failed to load team report.";
    throw new Error(message);
  }

  return response.json();
}

export async function regenerateTeamReport(teamId) {
  if (!teamId) throw new Error("teamId is required");

  const response = await fetch(apiUrl(`/ai/team-report/${teamId}/regenerate`), {
    method: "POST",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Failed to regenerate team report.";
    throw new Error(message);
  }

  return response.json();
}

export async function uploadTeamReportPdf(teamId, file) {
  if (!teamId) throw new Error("teamId is required");
  if (!file) throw new Error("file is required");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(apiUrl(`/ai/team-report/${teamId}/upload-pdf`), {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Failed to upload team report PDF.";
    throw new Error(message);
  }

  return response.json();
}
