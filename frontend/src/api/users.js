import { apiUrl } from "../config/api.js";

export async function registerUser(payload) {
  const res = await fetch(apiUrl("/users/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to register user");
  return res.json();
}

export async function getUserByUid(uid) {
  const res = await fetch(apiUrl(`/users/${uid}`));
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function updateUser(uid, updates) {
  const res = await fetch(apiUrl(`/users/${uid}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}
