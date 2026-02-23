import PDFDocument from "pdfkit";

const COLORS = {
  primary: "#FF681F",
  primarySoft: "#FFF5EE",
  primaryBorder: "#FFD8C2",
  text: "#111827",
  muted: "#64748B",
  white: "#FFFFFF",
  line: "#E2E8F0"
};

const SCOUT_HEADINGS = [
  "Offensive",
  "Passing profile",
  "Dribbling",
  "Defensive",
  "Strengths",
  "Development",
  "Conclusion"
];

const MAX_SNAPSHOT_LENGTH = 9000;

const normalizeForPdf = value =>
  String(value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");

const formatDate = value => {
  if (!value) return "-";
  const date = value?.toDate?.() || (value instanceof Date ? value : new Date(value));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return normalizeForPdf(String(value));

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatDateTime = value => {
  const date = value?.toDate?.() || (value instanceof Date ? value : new Date(value));
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hours}:${minutes}`;
};

const calculateAge = birthdate => {
  if (!birthdate) return "-";
  const date = birthdate?.toDate?.() || new Date(birthdate);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  const dayDiff = today.getDate() - date.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return String(age);
};

const sanitizeFileBase = value => {
  const cleaned = normalizeForPdf(String(value || "Player"))
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Player";
};

const toAsciiFileBase = value => {
  const ascii = normalizeForPdf(String(value || ""))
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ascii || "Player";
};

const formatNumberToken = token => {
  const num = Number(token);
  if (!Number.isFinite(num)) return token;
  return num.toFixed(2).replace(/\.?0+$/, "");
};

const formatNumbersInText = (value = "") =>
  String(value || "").replace(/-?\d+\.\d{3,}/g, match => formatNumberToken(match));

const sanitizeSnapshotText = (value = "") =>
  normalizeForPdf(
    formatNumbersInText(value)
      .replace(/\*\*/g, "")
      .replace(/#+/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();

const findNextHeadingIndex = (text, startIndex, headingOrder) => {
  let nextIndex = -1;
  for (const heading of headingOrder) {
    const idx = text.indexOf(heading, startIndex);
    if (idx !== -1 && (nextIndex === -1 || idx < nextIndex)) {
      nextIndex = idx;
    }
  }
  return nextIndex;
};

const parseSnapshotSections = (text = "") => {
  if (!text) return { cards: {}, summary: "", roleTitle: "" };

  try {
    const payload = JSON.parse(text);
    const cards = {};

    if (Array.isArray(payload.cards)) {
      payload.cards.forEach(card => {
        if (!card?.heading) return;
        const heading = sanitizeSnapshotText(card.heading || "");
        if (!heading) return;

        cards[heading] = {
          narrative: sanitizeSnapshotText(card.narrative || ""),
          number: sanitizeSnapshotText(card.number || ""),
          what: sanitizeSnapshotText(card.what_it_looks_like || ""),
          cue: sanitizeSnapshotText(card.coaching_cue || "")
        };
      });
    }

    return {
      cards,
      summary: sanitizeSnapshotText(payload.summary_text || ""),
      roleTitle: sanitizeSnapshotText(payload.role_title || "")
    };
  } catch {
    const normalized = normalizeForPdf(String(text || "")).replace(/\r/g, "");
    const sections = {};

    SCOUT_HEADINGS.forEach((heading, index) => {
      const start = normalized.indexOf(heading);
      const safeHeading = sanitizeSnapshotText(heading);
      if (start === -1) {
        sections[safeHeading] = { narrative: "" };
        return;
      }

      const remainingHeadings = SCOUT_HEADINGS.slice(index + 1);
      const nextIndex = findNextHeadingIndex(normalized, start + heading.length, remainingHeadings);
      const slice =
        nextIndex === -1
          ? normalized.slice(start + heading.length)
          : normalized.slice(start + heading.length, nextIndex);

      sections[safeHeading] = {
        narrative: sanitizeSnapshotText(slice)
      };
    });

    return { cards: sections, summary: "", roleTitle: "" };
  }
};

const extractRoleTitle = text => {
  if (!text) return "";
  const normalized = normalizeForPdf(String(text));
  const match = normalized.match(/Role title:\s*(.+)/i);
  if (match?.[1]) return sanitizeSnapshotText(match[1]);
  const firstLine = normalized.split(/\r?\n/)[0];
  return sanitizeSnapshotText(firstLine || "");
};

const tryDownloadImage = async url => {
  if (!url || typeof url !== "string") return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) return null;
    if (contentType.includes("webp")) return null;

    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
};

const drawImageBox = ({ doc, x, y, width, height, imageBuffer, placeholder }) => {
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(COLORS.white, COLORS.primaryBorder);

  if (imageBuffer) {
    try {
      doc.image(imageBuffer, x + 6, y + 6, {
        fit: [width - 12, height - 12],
        align: "center",
        valign: "center"
      });
      return;
    } catch {
      // fallback below
    }
  }

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(normalizeForPdf(placeholder), x + 10, y + height / 2 - 8, {
      width: width - 20,
      align: "center"
    });
};

const drawProfileHeader = ({
  doc,
  playerName,
  nationality,
  age,
  teamName,
  generatedAt,
  playerImageBuffer,
  teamImageBuffer
}) => {
  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  const imageWidth = 130;
  const imageHeight = 160;
  const gap = 18;
  const centerWidth = contentWidth - imageWidth * 2 - gap * 2;

  const leftX = left;
  const centerX = leftX + imageWidth + gap;
  const rightX = centerX + centerWidth + gap;

  doc
    .roundedRect(left - 8, top - 8, contentWidth + 16, imageHeight + 30, 14)
    .fillAndStroke(COLORS.white, COLORS.primaryBorder);

  drawImageBox({
    doc,
    x: leftX,
    y: top,
    width: imageWidth,
    height: imageHeight,
    imageBuffer: playerImageBuffer,
    placeholder: "Player photo"
  });

  drawImageBox({
    doc,
    x: rightX,
    y: top,
    width: imageWidth,
    height: imageHeight,
    imageBuffer: teamImageBuffer,
    placeholder: "Team logo"
  });

  const fields = [
    { label: "Name", value: playerName || "-" },
    { label: "Nationality", value: nationality || "-" },
    { label: "Age", value: age || "-" },
    { label: "Playing for", value: teamName || "-" }
  ];

  let rowY = top + 14;
  fields.forEach(field => {
    const label = normalizeForPdf(field.label);
    const value = normalizeForPdf(field.value);

    doc.font("Helvetica").fontSize(13).fillColor(COLORS.text).text(`${label}:`, centerX, rowY, {
      width: centerWidth,
      continued: true
    });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.text).text(` ${value}`);
    rowY += 32;
  });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Generated: ${formatDateTime(generatedAt)}`, centerX, top + imageHeight - 12, {
      width: centerWidth,
      align: "left"
    });

  doc.y = top + imageHeight + 28;
};

const drawSectionTitle = ({ doc, title }) => {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  const safeTitle = normalizeForPdf(title || "");

  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.primary).text(safeTitle, left, y);
  const textWidth = doc.widthOfString(safeTitle);
  const lineStart = left + textWidth + 10;

  if (lineStart < right) {
    doc
      .strokeColor(COLORS.line)
      .lineWidth(1)
      .moveTo(lineStart, y + 9)
      .lineTo(right, y + 9)
      .stroke();
  }

  doc.y = y + 20;
};

const drawParagraph = ({ doc, text }) => {
  const safe = sanitizeSnapshotText(text || "");
  if (!safe) return;

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(safe, left, doc.y, {
      width,
      lineGap: 2
    });

  doc.y += 6;
};

const buildInsightLines = card => {
  const lines = [];
  const narrative = sanitizeSnapshotText(card?.narrative || "");
  const number = sanitizeSnapshotText(card?.number || "");
  const what = sanitizeSnapshotText(card?.what || "");
  const cue = sanitizeSnapshotText(card?.cue || "");

  if (narrative) lines.push(narrative);
  if (number) lines.push(number);
  if (what) lines.push(`What it looks like: ${what}`);
  if (cue) lines.push(`Coaching cue: ${cue}`);

  return lines;
};

const estimateParagraphHeight = (doc, text, width) => {
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
  return (
    doc.heightOfString(text, {
      width,
      lineGap: 2
    }) + 6
  );
};

const estimateInsightBlockHeight = (doc, heading, lines) => {
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
  const headingHeight = doc.heightOfString(heading, { width });

  let total = headingHeight + 3;
  lines.forEach(line => {
    total += estimateParagraphHeight(doc, line, width);
  });
  total += 6;
  return total;
};

const ensureBlockFits = (doc, neededHeight) => {
  const bottom = doc.page.height - doc.page.margins.bottom - 12;
  const remaining = bottom - doc.y;
  if (neededHeight <= remaining) return;

  // On continuation pages, header sets y around margins.top + 14.
  const continuationTopY = doc.page.margins.top + 14;
  const fullPageCapacity = bottom - continuationTopY;
  if (neededHeight <= fullPageCapacity) {
    doc.addPage();
  }
};

const drawInsightBlock = ({ doc, heading, lines }) => {
  if (!lines.length) return;

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const safeHeading = normalizeForPdf(heading || "Insight");
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary);
  const headingHeight = doc.heightOfString(safeHeading, { width });
  const headingY = doc.y;

  doc
    .text(safeHeading, left, headingY, { width });
  doc.y = headingY + headingHeight + 3;

  lines.forEach(line => {
    drawParagraph({ doc, text: line });
  });

  const lineY = doc.y;

  doc
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .moveTo(left, lineY)
    .lineTo(left + width, lineY)
    .stroke();

  doc.y = lineY + 6;
};

const drawContinuationHeader = ({ doc, playerName }) => {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.page.margins.top - 10;
  const safeName = normalizeForPdf(playerName || "Player");

  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(`${safeName} - Insights`, left, y, {
    width
  });

  doc
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .moveTo(left, y + 14)
    .lineTo(left + width, y + 14)
    .stroke();

  doc.y = y + 24;
};

const addFooters = (doc, playerName) => {
  const range = doc.bufferedPageRange();
  const safeName = normalizeForPdf(playerName || "Player");

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const y = doc.page.height - doc.page.margins.bottom - 10;

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`Scoutify | ${safeName}`, left, y, {
        width,
        lineBreak: false
      });

    doc.text(`Page ${i + 1} / ${range.count}`, left, y, {
      width,
      align: "right",
      lineBreak: false
    });
  }
};

export const streamPlayerCvPdf = async ({ res, player, team, scoutSnapshot }) => {
  const playerName = sanitizeSnapshotText(player?.name || "Player") || "Player";
  const nationality = sanitizeSnapshotText(player?.nationality || "-") || "-";
  const age = calculateAge(player?.birthdate);
  const teamName = sanitizeSnapshotText(team?.name || player?.teamName || "-") || "-";

  const rawSnapshot = String(scoutSnapshot || "").slice(0, MAX_SNAPSHOT_LENGTH);
  const parsed = parseSnapshotSections(rawSnapshot);
  const roleTitle = parsed.roleTitle || extractRoleTitle(rawSnapshot);

  const orderedHeadings = [
    ...SCOUT_HEADINGS.map(heading => sanitizeSnapshotText(heading)).filter(Boolean),
    ...Object.keys(parsed.cards || {}).filter(heading => {
      const safe = sanitizeSnapshotText(heading);
      return safe && !SCOUT_HEADINGS.map(item => sanitizeSnapshotText(item)).includes(safe);
    })
  ];

  const cards = orderedHeadings
    .map(heading => ({ heading, card: parsed.cards?.[heading] }))
    .filter(item => item.card && typeof item.card === "object");

  const [playerImageBuffer, teamImageBuffer] = await Promise.all([
    tryDownloadImage(player?.photoURL),
    tryDownloadImage(team?.photoURL)
  ]);

  const fileBase = sanitizeFileBase(playerName);
  const asciiBase = toAsciiFileBase(fileBase);
  const utf8FileName = `${fileBase}.pdf`;
  const asciiFileName = `${asciiBase}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(utf8FileName)}`
  );

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 42, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
    info: {
      Title: `${normalizeForPdf(playerName)} Player CV`,
      Author: "Scoutify",
      Subject: "Player profile insights"
    }
  });

  doc.pipe(res);

  let bodyStarted = false;
  let writingFooters = false;
  doc.on("pageAdded", () => {
    if (!bodyStarted || writingFooters) return;
    drawContinuationHeader({ doc, playerName });
  });

  drawProfileHeader({
    doc,
    playerName,
    nationality,
    age,
    teamName,
    generatedAt: new Date(),
    playerImageBuffer,
    teamImageBuffer
  });

  doc.y += 12;
  bodyStarted = true;
  const insightBlocks = [];
  if (roleTitle) {
    insightBlocks.push({
      heading: "Role title",
      lines: buildInsightLines({ narrative: roleTitle })
    });
  }

  if (parsed.summary) {
    insightBlocks.push({
      heading: "Summary",
      lines: buildInsightLines({ narrative: parsed.summary })
    });
  }

  cards.forEach(({ heading, card }) => {
    insightBlocks.push({
      heading,
      lines: buildInsightLines(card)
    });
  });

  const titleText = "Season Grade Insights";
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.primary);
  const titleHeight = doc.heightOfString(titleText, { width: contentWidth }) + 6;
  const firstBlockHeight =
    insightBlocks.length > 0
      ? estimateInsightBlockHeight(
          doc,
          normalizeForPdf(insightBlocks[0].heading || "Insight"),
          insightBlocks[0].lines
        )
      : 42;
  ensureBlockFits(doc, titleHeight + firstBlockHeight);
  drawSectionTitle({ doc, title: titleText });

  insightBlocks.forEach(block => {
    const safeHeading = normalizeForPdf(block.heading || "Insight");
    const neededHeight = estimateInsightBlockHeight(doc, safeHeading, block.lines);
    ensureBlockFits(doc, neededHeight);
    drawInsightBlock({
      doc,
      heading: safeHeading,
      lines: block.lines
    });
  });

  if (insightBlocks.length === 0) {
    ensureBlockFits(doc, 80);
    drawParagraph({
      doc,
      text: "No season insights available yet. Regenerate insights from the player profile and try downloading again."
    });
  }

  writingFooters = true;
  addFooters(doc, playerName);
  writingFooters = false;
  doc.end();
};
