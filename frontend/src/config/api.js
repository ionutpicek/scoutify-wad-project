const REMOTE_API_URL = "https://scoutify-2yhu.onrender.com";
const LOCAL_API_URL = "http://localhost:3001";

// Allow overriding the target API via Vite env for staging/production switches.
export const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL ||
  (import.meta.env?.DEV ? LOCAL_API_URL : REMOTE_API_URL);

export const apiUrl = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
