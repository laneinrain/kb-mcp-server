import { describe, expect, it } from "vitest";
import {
  computeContentHash,
  deriveDocumentIdForUserFile,
  normalizeParsedText,
} from "./content-hash.js";

describe("content-hash", () => {
  it("normalizeParsedText normalizes line endings and trims", () => {
    expect(normalizeParsedText("  hello\r\nworld  ")).toBe("hello\nworld");
  });

  it("computeContentHash is stable for equivalent normalization", () => {
    const a = computeContentHash("hello\nworld");
    const b = computeContentHash("hello\r\nworld");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("deriveDocumentIdForUserFile is stable per user and filename", () => {
    const first = deriveDocumentIdForUserFile("user-a", "doc.md");
    const second = deriveDocumentIdForUserFile("user-a", "doc.md");
    const other = deriveDocumentIdForUserFile("user-b", "doc.md");
    expect(first).toBe(second);
    expect(first).not.toBe(other);
  });
});
