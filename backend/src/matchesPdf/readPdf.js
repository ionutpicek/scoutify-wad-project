// src/matches/readPdf.js
import pdf from "pdf-parse";

export async function readPdf(buffer) {
  const data = await pdf(buffer);
  return data.text;
}
