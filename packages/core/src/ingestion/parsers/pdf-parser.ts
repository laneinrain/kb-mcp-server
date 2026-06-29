import { readFileSync, statSync } from "node:fs";
import pdfParse from "pdf-parse";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const INSUFFICIENT_TEXT_ERROR =
  "No sufficient text layer detected — scanned PDFs are not supported in v1.";

function minimumTextThreshold(pageCount: number): number {
  return Math.max(50, Math.ceil(pageCount * 0.1));
}

export async function parsePdf(
  filePath: string,
): Promise<{ text: string; pageCount: number }> {
  const { size } = statSync(filePath);
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error("PDF file exceeds maximum size of 50MB");
  }

  try {
    const buffer = readFileSync(filePath);
    const result = await pdfParse(buffer);
    const text = result.text ?? "";
    const trimmed = text.trim();
    const pageCount = result.numpages ?? 1;
    const threshold = minimumTextThreshold(pageCount);

    if (trimmed.length < threshold) {
      throw new Error(INSUFFICIENT_TEXT_ERROR);
    }

    return { text, pageCount };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === INSUFFICIENT_TEXT_ERROR
    ) {
      throw error;
    }

    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
