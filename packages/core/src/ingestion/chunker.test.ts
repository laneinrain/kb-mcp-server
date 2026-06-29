import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ChunkConfig } from "../registry/types.js";
import { chunkText } from "./chunker.js";

const testConfig: ChunkConfig = {
  chunkSize: 50,
  chunkOverlap: 10,
};

describe("chunkText", () => {
  it(
    "splits long input into multiple chunks with overlap from config",
    async () => {
      const text = "token ".repeat(500);
      const chunks = await chunkText(text, testConfig);

      expect(chunks.length).toBeGreaterThan(1);
    },
    30_000,
  );

  it("uses TokenTextSplitter not RecursiveCharacterTextSplitter", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "chunker.ts"),
      "utf-8",
    );

    expect(source).toContain("TokenTextSplitter");
    expect(source).not.toContain("RecursiveCharacterTextSplitter");
  });
});
