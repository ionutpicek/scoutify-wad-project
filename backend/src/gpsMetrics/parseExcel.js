import xlsx from "xlsx";

const normalize = str =>
  String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\\s.:-]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();

function toNumber(val) {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const num = parseFloat(String(val).replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function parseDurationMinutes(raw) {
  if (raw == null || raw === "") return null;
  // Excel duration often comes as a fraction of a day (e.g., 0.0335)
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // convert days to minutes
    return raw * 24 * 60;
  }
  const parts = String(raw).split(":").map(x => parseFloat(x));
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 60 + m + (s || 0) / 60;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m + (s || 0) / 60;
  }
  return null;
}

export function parseExcelMetrics(buffer) {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const parsed = [];

  for (const row of rows) {
    // Normalize headers on the fly
    const entries = Object.entries(row).map(([k, v]) => [normalize(k), v]);
    const get = (regex) => {
      const found = entries.find(([k]) => regex.test(k));
      return found ? found[1] : null;
    };

    const name = get(/player name/);
    if (!name) continue;

    const numberRaw = get(/player number/);
    const number = toNumber(numberRaw);

    const totalDistance = toNumber(get(/total distance/));
    const maxSpeed = toNumber(get(/max(imum)? speed/));
    const avgBpm = toNumber(get(/hr avg/));
    const sprints = toNumber(get(/^sprints$/));
    // High accelerations (optional)
    const accHigh = toNumber(get(/accelerations/));

    const durationRaw = get(/duration/);
    const durationMinutes = parseDurationMinutes(durationRaw);

    const distVal = totalDistance != null ? totalDistance : null;

    const durationVal = durationMinutes != null ? durationMinutes : null;

    parsed.push({
      name: String(name).trim(),
      number: Number.isFinite(number) ? number : null,
      totalDistance: distVal.toFixed(2), // meters
      maxSpeed: maxSpeed != null ? maxSpeed.toFixed(2) : null, // km/h
      avgBpm: avgBpm != null ? avgBpm : null,
      sprints: sprints != null ? sprints : null,
      accHigh: accHigh != null ? accHigh : null,
      durationMinutes: durationVal.toFixed(2),
    });
  }

  return parsed;
}
