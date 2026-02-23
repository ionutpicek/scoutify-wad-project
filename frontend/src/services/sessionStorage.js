const STORAGE_KEY = "scoutify-user";
const INSIGHT_LANGUAGE_KEY = "scoutify-insight-language";

export const setCurrentUser = (payload) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist user session:", error);
  }
};

export const getCurrentUser = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to read user session:", error);
    return null;
  }
};

export const clearCurrentUser = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear user session:", error);
  }
};

export const setPreferredInsightLanguage = (language) => {
  try {
    const normalized = String(language || "").trim().toLowerCase();
    if (normalized !== "en" && normalized !== "ro") return;
    window.localStorage.setItem(INSIGHT_LANGUAGE_KEY, normalized);
  } catch (error) {
    console.warn("Failed to persist insight language preference:", error);
  }
};

export const getPreferredInsightLanguage = () => {
  try {
    const raw = window.localStorage.getItem(INSIGHT_LANGUAGE_KEY);
    if (!raw) return null;
    const normalized = String(raw).trim().toLowerCase();
    return normalized === "en" || normalized === "ro" ? normalized : null;
  } catch (error) {
    console.warn("Failed to read insight language preference:", error);
    return null;
  }
};
