import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function fallbackLine({ match, performer, side }) {
  if (!performer) return null;
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const stats = performer.keyStats || {};
  const statEntries = Object.entries(stats)
    .filter(([, v]) => v != null && v !== 0)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const grade = performer.gameGrade ?? performer.grade ?? null;
  return [
    `${team}:`,
    performer.name || performer.canonicalName || "Unknown",
    grade != null ? `(grade ${Number(grade).toFixed(1)})` : "",
    statEntries ? `| ${statEntries}` : "",
    match.score ? `| Score ${match.score}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

async function generateLine({ match, performer, side }) {
  if (!performer) return null;
  if (!client) {
    return fallbackLine({ match, performer, side });
  }

  try {
    const opponent =
      side === "home" ? match.awayTeam : match.homeTeam;
    const team =
      side === "home" ? match.homeTeam : match.awayTeam;

    const prompt = [
      "One-sentence highlight for a team's best performer.",
      "Be concise, factual, no fluff. Mention player, team, key stats, and match score.",
      `Team: ${team}`,
      `Opponent: ${opponent}`,
      match.score ? `Score: ${match.score}` : null,
      performer
        ? `Performer: ${performer.name || "N/A"} (${performer.role || ""}), grade ${performer.gameGrade ?? performer.grade ?? "N/A"}, key stats: ${JSON.stringify(performer.keyStats || {})}`
        : null
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 60
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.error("generateMatchSummary failed:", err);
    return null;
  }
}

export async function generateTeamHighlights({ match, bestPerformers }) {
  if (!client) {
    return {
      home: fallbackLine({ match, performer: bestPerformers?.home, side: "home" }),
      away: fallbackLine({ match, performer: bestPerformers?.away, side: "away" })
    };
  }

  const homePromise = generateLine({
    match,
    performer: bestPerformers?.home,
    side: "home"
  });

  const awayPromise = generateLine({
    match,
    performer: bestPerformers?.away,
    side: "away"
  });

  const [home, away] = await Promise.all([homePromise, awayPromise]);
  return { home, away };
}
