// src/matches/parseMatchPdf.js

import { readPdf } from "./readPdf.js";
import { normalizeText } from "./normalizeText.js";
import { extractMatchInfoFromFilename } from "./extractMatchInfoFromFilename.js";
import { extractPlayers } from "./extractPlayers.js";
import { extractPlayerMinutes } from "./extractMinutes.js";
import { extractPlayerPositions } from "./extractPosition.js";
import { extractMatchStats } from "./extractMatchStats.js";
import { extractMatchDate } from "./extractMatchDate.js";
import { extractMatchRound } from "./extractRoundNr.js";
import { extractTeamStats } from "./extractTeamStats.js";

export async function parseMatchPdf(buffer, filename) {
  const matchInfo = extractMatchInfoFromFilename(filename);

  const rawText = await readPdf(buffer);
  const text = normalizeText(rawText);

  const players = extractPlayers(text);

  const minutesByPlayer = extractPlayerMinutes(text, players); // keys normalized in that file
  const positionsByPlayer = extractPlayerPositions(text); // keys normalized here
  const statsByPlayer = extractMatchStats(text, players);
  const date = extractMatchDate(text);
  const round = extractMatchRound(text);
  const teamStats = extractTeamStats(rawText); // use raw text to preserve layout for team stats

  return {
    ...matchInfo,
    players,
    date,
    round,
    minutesByPlayer,
    positionsByPlayer,
    statsByPlayer,
    teamStats
  };
}
