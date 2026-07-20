import { describe, expect, it } from "vitest";
import { isAllowedUpload } from "./document-upload.js";

describe("isAllowedUpload", () => {
  it("accepts markdown with browser octet-stream mime", () => {
    expect(isAllowedUpload("notes.md", "application/octet-stream")).toBe(true);
    expect(isAllowedUpload("notes.markdown", "application/octet-stream")).toBe(
      true,
    );
  });

  it("accepts text/markdown and text/x-markdown", () => {
    expect(isAllowedUpload("a.md", "text/markdown")).toBe(true);
    expect(isAllowedUpload("a.md", "text/x-markdown")).toBe(true);
    expect(isAllowedUpload("a.md", "text/markdown; charset=utf-8")).toBe(true);
  });

  it("accepts txt/pdf with expected or generic mime", () => {
    expect(isAllowedUpload("a.txt", "text/plain")).toBe(true);
    expect(isAllowedUpload("a.txt", "application/octet-stream")).toBe(true);
    expect(isAllowedUpload("a.pdf", "application/pdf")).toBe(true);
    expect(isAllowedUpload("a.pdf", "application/octet-stream")).toBe(true);
  });

  it("rejects disallowed extensions even with allowed mime", () => {
    expect(isAllowedUpload("a.docx", "application/octet-stream")).toBe(false);
    expect(isAllowedUpload("a.exe", "text/markdown")).toBe(false);
  });

  it("rejects pdf claimed as unrelated non-generic mime", () => {
    expect(isAllowedUpload("a.pdf", "image/png")).toBe(false);
  });
});
