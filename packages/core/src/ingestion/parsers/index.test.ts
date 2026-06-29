import { describe, expect, it } from "vitest";
import { parseDocument } from "./index.js";

describe("parseDocument", () => {
  it("throws clear error for unsupported extension", async () => {
    await expect(parseDocument("/path/to/file.docx")).rejects.toThrow(
      /Unsupported file extension/i,
    );
  });
});
