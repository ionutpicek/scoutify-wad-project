import OpenAI, { toFile } from "openai";
import pdf from "pdf-parse";

const MODEL_NAME = "gpt-5.2";
const MIN_EXTRACTED_TEXT_CHARS = 1200;

let openai = null;

const getOpenAI = () => {
  if (!openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (key) {
      console.log("OpenAI API key: Configured");
      openai = new OpenAI({ apiKey: key });
    } else {
      console.log("OpenAI API key: Not configured");
    }
  }
  return openai;
};

const parseAiJson = raw => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (err) {
      return null;
    }
  }
};

const normalizeList = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
};

const normalizeSupplement = ({ filename, payload }) => {
  const now = new Date().toISOString();
  const sourceName =
    typeof payload?.sourceName === "string" && payload.sourceName.trim()
      ? payload.sourceName.trim()
      : filename;
  const summary =
    typeof payload?.summary === "string" && payload.summary.trim()
      ? payload.summary.trim()
      : "Supplemental document parsed, but summary quality was low.";
  const tacticalThemes = normalizeList(payload?.tacticalThemes, [
    "No clear tactical theme extracted."
  ]);
  const strengths = normalizeList(payload?.strengths);
  const weaknesses = normalizeList(payload?.weaknesses);
  const opponentPlanHints = normalizeList(payload?.opponentPlanHints);
  const keyNumbers = Array.isArray(payload?.keyNumbers)
    ? payload.keyNumbers
        .map(item => ({
          label: typeof item?.label === "string" ? item.label.trim() : "",
          value: typeof item?.value === "string" ? item.value.trim() : "",
          context: typeof item?.context === "string" ? item.context.trim() : ""
        }))
        .filter(item => item.label && item.value)
    : [];

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceName,
    summary,
    tacticalThemes: tacticalThemes.slice(0, 8),
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 6),
    opponentPlanHints: opponentPlanHints.slice(0, 6),
    keyNumbers: keyNumbers.slice(0, 10),
    generatedAt: now
  };
};

const extractTextFromPdf = async buffer => {
  const parsed = await pdf(buffer);
  return (parsed?.text || "").replace(/\u0000/g, " ").trim();
};

const extractTextWithOcr = async ({ client, buffer, filename }) => {
  if (!client || !client.files || !client.responses) return "";

  let uploadedFile = null;
  try {
    const file = await toFile(buffer, filename || "team-report.pdf", {
      type: "application/pdf"
    });
    uploadedFile = await client.files.create({
      file,
      purpose: "user_data"
    });

    const response = await client.responses.create({
      model: MODEL_NAME,
      temperature: 0,
      max_output_tokens: 12000,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "OCR this PDF and return all readable tactical/report text as plain text only, preserving headings and numeric lines where possible."
            },
            {
              type: "input_file",
              file_id: uploadedFile.id
            }
          ]
        }
      ]
    });

    if (typeof response?.output_text === "string") {
      return response.output_text.trim();
    }

    const textChunks = [];
    const output = Array.isArray(response?.output) ? response.output : [];
    output.forEach(item => {
      const content = Array.isArray(item?.content) ? item.content : [];
      content.forEach(part => {
        if (typeof part?.text === "string" && part.text.trim()) {
          textChunks.push(part.text.trim());
        }
      });
    });
    return textChunks.join("\n").trim();
  } catch (error) {
    console.warn("OCR extraction failed:", error.message || error);
    return "";
  } finally {
    if (uploadedFile?.id && client.files?.del) {
      client.files.del(uploadedFile.id).catch(() => {});
    }
  }
};

const buildSupplementPrompt = ({ teamName, filename, extractedText }) => `
Return ONLY JSON matching this schema:
{
  "sourceName": string,
  "summary": string,
  "tacticalThemes": [string],
  "strengths": [string],
  "weaknesses": [string],
  "opponentPlanHints": [string],
  "keyNumbers": [
    { "label": string, "value": string, "context": string }
  ]
}

Context:
- Team: ${teamName || "Unknown"}
- Source file: ${filename}

Extracted report text:
${extractedText}

Rules:
- Keep the output concise and scannable.
- summary: 2-4 sentences.
- tacticalThemes: 3-8 points.
- strengths / weaknesses / opponentPlanHints: 3-6 points each when available.
- keyNumbers: up to 10 high-value numeric snippets (xG, PPDA, shots, pass %, recoveries, duels, etc.).
- No markdown, no extra keys.
`.trim();

export async function extractTeamSupplementFromPdf({ pdfBuffer, filename, teamName }) {
  const textFromPdf = await extractTextFromPdf(pdfBuffer);
  const client = getOpenAI();

  let extractedText = textFromPdf;
  if (extractedText.length < MIN_EXTRACTED_TEXT_CHARS && client) {
    const ocrText = await extractTextWithOcr({
      client,
      buffer: pdfBuffer,
      filename
    });
    if (ocrText.length > extractedText.length) {
      extractedText = ocrText;
    }
  }

  if (!extractedText) {
    throw new Error("Could not extract text from PDF. Try a clearer or text-based report.");
  }

  if (!client) {
    return normalizeSupplement({
      filename,
      payload: {
        sourceName: filename,
        summary: extractedText.slice(0, 900),
        tacticalThemes: ["OpenAI key missing; only raw text preview could be produced."],
        strengths: [],
        weaknesses: [],
        opponentPlanHints: [],
        keyNumbers: []
      }
    });
  }

  const prompt = buildSupplementPrompt({ teamName, filename, extractedText });
  try {
    const response = await client.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "You are a senior football analyst. Extract tactical information and return strict JSON."
        },
        { role: "user", content: prompt }
      ]
    });

    const message = response?.choices?.[0]?.message?.content?.trim();
    const parsed = parseAiJson(message);
    if (!parsed) {
      throw new Error("AI returned an invalid JSON payload.");
    }
    return normalizeSupplement({ filename, payload: parsed });
  } catch (error) {
    console.warn("Supplement structuring failed, using fallback:", error.message || error);
    return normalizeSupplement({
      filename,
      payload: {
        sourceName: filename,
        summary: extractedText.slice(0, 900),
        tacticalThemes: ["Partial extraction succeeded but structure quality is limited."],
        strengths: [],
        weaknesses: [],
        opponentPlanHints: [],
        keyNumbers: []
      }
    });
  }
}

export default extractTeamSupplementFromPdf;
