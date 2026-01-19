const DEFAULT_API_BASE_URL = "https://scoutify-2yhu.onrender.com";

// Allow overriding the target API via Vite env for staging/production switches.
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export const apiUrl = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
