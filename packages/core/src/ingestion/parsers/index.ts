import { basename, extname } from "node:path";
import { parseMd } from "./md-parser.js";
import { parsePdf } from "./pdf-parser.js";
import { parseTxt } from "./txt-parser.js";

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".pdf"]);

const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".pdf": "application/pdf",
};

export interface ParsedDocument {
  text: string;
  mimeType: string;
  filename: string;
}

export async function parseDocument(
  filePath: string,
): Promise<ParsedDocument> {
  const ext = extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension: ${ext || "(none)"}. Supported: .txt, .md, .markdown, .pdf`,
    );
  }

  const filename = basename(filePath);
  const mimeType = MIME_TYPES[ext]!;

  let text: string;
  switch (ext) {
    case ".txt":
      text = await parseTxt(filePath);
      break;
    case ".md":
    case ".markdown":
      text = await parseMd(filePath);
      break;
    case ".pdf":
      text = (await parsePdf(filePath)).text;
      break;
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }

  return { text, mimeType, filename };
}

export { parseTxt } from "./txt-parser.js";
export { parseMd } from "./md-parser.js";
export { parsePdf, INSUFFICIENT_TEXT_ERROR } from "./pdf-parser.js";
