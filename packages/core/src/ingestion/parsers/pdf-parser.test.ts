import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(() => Buffer.from("fake-pdf-bytes")),
    statSync: vi.fn(() => ({ size: 1024 })),
  };
});

vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

import pdfParse from "pdf-parse";
import { parsePdf } from "./pdf-parser.js";

const pdfParseMock = vi.mocked(pdfParse);

describe("parsePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects text with length below max(50, ceil(pageCount * 0.1)) threshold", async () => {
    pdfParseMock.mockResolvedValue({
      text: "short",
      numpages: 10,
    } as never);

    await expect(parsePdf("/fake/scanned.pdf")).rejects.toThrow(
      /No sufficient text layer detected|scanned PDF/i,
    );
  });

  it("accepts text above threshold", async () => {
    const longText = "word ".repeat(100);
    pdfParseMock.mockResolvedValue({
      text: longText,
      numpages: 2,
    } as never);

    const result = await parsePdf("/fake/valid.pdf");

    expect(result.text).toBe(longText);
    expect(result.pageCount).toBe(2);
  });
});
