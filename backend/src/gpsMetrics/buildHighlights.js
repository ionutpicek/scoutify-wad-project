export function buildExcelHighlights(players = []) {
  if (!players.length) return null;

  const topBy = key =>
    players.reduce((a, b) => ((b?.[key] || 0) > (a?.[key] || 0) ? b : a), players[0]);

  const maxSpeed = topBy("maxSpeed");
  const maxDist = topBy("totalDistance");
  const maxSprints = topBy("sprints");
  const maxAcc = topBy("accHigh");

  const facts = [];
  if (maxSpeed?.maxSpeed) facts.push(`Top speed: ${maxSpeed.name} (${maxSpeed.maxSpeed} km/h)`);
  if (maxDist?.totalDistance) facts.push(`Longest distance: ${maxDist.name} (${Math.round(maxDist.totalDistance / 100) / 10} km)`);
  if (maxSprints?.sprints) facts.push(`Most sprints: ${maxSprints.name} (${maxSprints.sprints})`);
  if (maxAcc?.accHigh) facts.push(`Most high accels: ${maxAcc.name} (${maxAcc.accHigh})`);

  return facts.join(" | ");
}