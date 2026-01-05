// src/matches/mapPlayerStats.js
export function mapPlayerStats(player, mapping) {
  const stats = {};

  for (const [pdfIndex, field] of Object.entries(mapping)) {
    stats[field] = Number(player.rawStats[pdfIndex]) || 0;
  }

  return {
    ...player,
    stats
  };
}
