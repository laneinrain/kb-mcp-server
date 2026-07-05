import { createHash } from "node:crypto";

export function normalizeParsedText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export function computeContentHash(text: string): string {
  return createHash("sha256")
    .update(normalizeParsedText(text))
    .digest("hex");
}

export function deriveDocumentIdForUserFile(
  userId: string,
  filename: string,
): string {
  return createHash("sha256")
    .update(`${userId}\0${filename}`)
    .digest("hex");
}
