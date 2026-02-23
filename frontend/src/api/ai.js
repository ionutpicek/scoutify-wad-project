import { apiUrl } from "../config/api.js";

const ALLOWED_REPORT_LANGUAGES = new Set(["en", "ro"]);

const normalizeReportLanguage = language => {
  if (typeof language !== "string") return null;
  const normalized = language.trim().toLowerCase();
  return ALLOWED_REPORT_LANGUAGES.has(normalized) ? normalized : null;
};

const extractFilenameFromContentDisposition = (headerValue, fallbackName = "player-cv.pdf") => {
  if (typeof headerValue !== "string" || !headerValue.trim()) return fallbackName;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/[/\\?%*:|"<>]/g, "-");
  }

  const basicMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1].replace(/[/\\?%*:|"<>]/g, "-");
  }

  return fallbackName;
};

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

export async function regenerateTeamReport(teamId, { language = "en" } = {}) {
  if (!teamId) throw new Error("teamId is required");
  const reportLanguage = normalizeReportLanguage(language);
  if (!reportLanguage) throw new Error("language must be one of: en, ro");

  const response = await fetch(apiUrl(`/ai/team-report/${teamId}/regenerate`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ language: reportLanguage }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Failed to regenerate team report.";
    throw new Error(message);
  }

  return response.json();
}

export async function uploadTeamReportPdf(teamId, file, { language = "en" } = {}) {
  if (!teamId) throw new Error("teamId is required");
  if (!file) throw new Error("file is required");
  const reportLanguage = normalizeReportLanguage(language);
  if (!reportLanguage) throw new Error("language must be one of: en, ro");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", reportLanguage);

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

export async function downloadPlayerCvPdf(
  playerDocId,
  { idToken, fallbackFileName = "Player.pdf" } = {}
) {
  if (!playerDocId) throw new Error("playerDocId is required");

  const response = await fetch(apiUrl(`/ai/player-cv/${playerDocId}.pdf`), {
    method: "GET",
    headers: idToken
      ? {
          Authorization: `Bearer ${idToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error || "Failed to generate player CV PDF.";
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName = extractFilenameFromContentDisposition(
    response.headers.get("content-disposition"),
    fallbackFileName
  );
  return { blob, fileName };
}

export async function getTacticalLineupPlan(payload) {
  const response = await fetch(apiUrl("/ai/tactical-lineup"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to generate tactical lineup plan.");
  }

  return response.json();
}
