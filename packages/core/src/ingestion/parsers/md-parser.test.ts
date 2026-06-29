import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseMd } from "./md-parser.js";

describe("parseMd", () => {
  it("strips YAML frontmatter via gray-matter", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kb-md-"));
    const filePath = join(dir, "sample.md");
    const raw = `---
title: Test Doc
tags:
  - alpha
---

# Heading

Body content only.`;

    writeFileSync(filePath, raw, "utf-8");

    const result = await parseMd(filePath);

    expect(result).not.toContain("title: Test Doc");
    expect(result).toContain("# Heading");
    expect(result).toContain("Body content only.");
  });
});
