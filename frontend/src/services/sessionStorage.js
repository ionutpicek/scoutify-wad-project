const STORAGE_KEY = "scoutify-user";

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
