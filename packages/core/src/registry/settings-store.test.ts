import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "@kb/config";
import { getDocumentRegistry } from "./document-registry.js";
import { getSettingsStore } from "./settings-store.js";

function makeConfig(dbPath: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    CHERRYIN_API_KEY: "test-key",
    CHERRYIN_BASE_URL: "https://open.cherryin.cc",
    CHROMA_HOST: "localhost",
    CHROMA_PORT: 8000,
    CHUNK_SIZE: 1024,
    CHUNK_OVERLAP: 154,
    SQLITE_PATH: dbPath,
    DATA_DIR: "./data",
    BACKEND_HOST: "127.0.0.1",
    BACKEND_PORT: 3000,
    DEFAULT_COLLECTION: "default",
    EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
    EMBEDDING_DIMENSIONS: 1024,
    ...overrides,
  };
}

describe("SettingsStore", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-settings-"));
    dbPath = join(tempDir, "test.db");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("seeds settings row from env defaults on first boot", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));
    const row = store.db
      .prepare("SELECT chunk_size, chunk_overlap FROM settings WHERE id = 1")
      .get() as { chunk_size: number; chunk_overlap: number };

    expect(row.chunk_size).toBe(1024);
    expect(row.chunk_overlap).toBe(154);
    store.db.close();
  });

  it("getChunkConfig returns persisted values after seed", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));
    expect(store.getChunkConfig()).toEqual({
      chunkSize: 1024,
      chunkOverlap: 154,
    });
    store.db.close();
  });
});

describe("DocumentRegistry", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-registry-"));
    dbPath = join(tempDir, "test.db");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("upserts document metadata and tracks chunk IDs", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));
    const registry = getDocumentRegistry(store.db);

    const doc = registry.registerDocument({
      id: "doc-1",
      filename: "notes.txt",
      sourcePath: "/data/notes.txt",
      mimeType: "text/plain",
      collection: "default",
    });

    expect(doc.id).toBe("doc-1");
    expect(doc.filename).toBe("notes.txt");
    expect(registry.getDocument("doc-1")).toMatchObject({ id: "doc-1" });

    registry.trackChunkIds("doc-1", ["doc-1:0", "doc-1:1"]);
    expect(registry.getChunkIds("doc-1")).toEqual(["doc-1:0", "doc-1:1"]);

    store.db.close();
  });

  it("deleteDocument removes metadata row", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));
    const registry = getDocumentRegistry(store.db);

    registry.registerDocument({
      id: "doc-2",
      filename: "readme.md",
      sourcePath: "/data/readme.md",
      mimeType: "text/markdown",
      collection: "default",
    });

    registry.deleteDocument("doc-2");
    expect(registry.getDocument("doc-2")).toBeUndefined();

    store.db.close();
  });
});
