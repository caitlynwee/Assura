/**
 * pdf-extract.ts — thin wrapper around pdf-parse for server-side use only.
 *
 * Returns extracted plain text and page count. Truncates to ~48,000 chars so
 * the result fits comfortably in the LLM context window alongside history and
 * the system prompt (DeepSeek 64K window).
 */

const MAX_CHARS = 48_000;

export interface PdfExtractResult {
  text: string;
  pageCount: number;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractResult> {
  // Lazy-require so the native canvas polyfill error doesn't blow up at module
  // evaluation time (which happens during Next.js static build phase).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buf: Buffer
  ) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(buffer);
  const raw = data.text ?? "";
  const text = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) : raw;
  return { text, pageCount: data.numpages ?? 0 };
}
