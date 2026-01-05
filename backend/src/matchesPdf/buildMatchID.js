export function buildMatchId({ date, homeTeam, awayTeam }) {
  const fixMojibake = str =>
    String(str || "")
      .replace(/Å£/g, "t")
      .replace(/ÅŸ/g, "s")
      .replace(/Äƒ/g, "a")
      .replace(/Ã¢/g, "a")
      .replace(/Ã®/g, "i")
      .replace(/Ä‚/g, "a")
      .replace(/Åž/g, "s")
      .replace(/Å/g, "s");

  return `${fixMojibake(homeTeam)}-${fixMojibake(awayTeam)}-${date}`
    .toLowerCase()
    .normalize("NFD")                 // handle diacritics
    .replace(/[\u0300-\u036f]/g, "")  // remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
