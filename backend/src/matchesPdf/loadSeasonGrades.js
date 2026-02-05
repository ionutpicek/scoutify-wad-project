// src/matches/loadSeasonGrades.js
import { getMysqlPool, isMysqlConfigured } from "../mysql/client.js";

const shouldUseMysql = () => isMysqlConfigured();

const parseSourcePayload = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

export async function loadSeasonGrades(playerIds) {
  const map = {};

  if (!playerIds?.length) return map;

  const uniqueIds = [...new Set(playerIds)].filter(Boolean);

  if (!shouldUseMysql()) {
    return map;
  }

  const mysql = getMysqlPool();
  const [rows] = await mysql.query(
    `SELECT player_id, source_payload
     FROM stats
     WHERE player_id IN (?)`,
    [uniqueIds]
  );

  rows.forEach(row => {
    const payload = parseSourcePayload(row.source_payload);
    if (payload?.seasonGrade) {
      map[row.player_id] = payload.seasonGrade;
    }
  });

  return map;
}
