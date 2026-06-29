import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseTxt } from "./txt-parser.js";

describe("parseTxt", () => {
  it("returns file contents as string", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kb-txt-"));
    const filePath = join(dir, "sample.txt");
    const content = "Hello from a plain text file.\nSecond line.";
    writeFileSync(filePath, content, "utf-8");

    await expect(parseTxt(filePath)).resolves.toBe(content);
  });
});
