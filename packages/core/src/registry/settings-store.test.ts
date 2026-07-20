import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
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
    READ_AROUND_WINDOW_DEFAULT: 1,
    READ_AROUND_WINDOW_MAX: 3,
    READ_AROUND_MAX_CHARS: 32000,
    READ_FILE_MAX_CHUNKS: 50,
    READ_FILE_MAX_CHARS: 64000,
    SQLITE_PATH: dbPath,
    DATA_DIR: "./data",
    BACKEND_HOST: "127.0.0.1",
    BACKEND_PORT: 3000,
    MCP_HTTP_HOST: "127.0.0.1",
    MCP_HTTP_PORT: 3100,
    MCP_AUTH_REQUIRED: true,
    DEFAULT_COLLECTION: "default",
    EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
    EMBEDDING_DIMENSIONS: 1024,
    RERANK_ENABLED: false,
    RERANK_CANDIDATES: 30,
    RERANK_MODEL: "qwen/qwen3-reranker-0.6b",
    AUTH_ENABLED: false,
    USER_AUTH_ENABLED: false,
    JWT_EXPIRES_IN: 604800,
    AUTH_SQLITE_PATH: "./data/sqlite/auth.db",
    AUTH_PROVIDER: "cas",
    CAS_MOCK: true,
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

  it("seeds context columns from env defaults on first boot", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));
    const row = store.db
      .prepare(
        `SELECT
          read_around_window_default,
          read_around_window_max,
          read_around_max_chars,
          read_file_max_chunks,
          read_file_max_chars
        FROM settings WHERE id = 1`,
      )
      .get() as {
      read_around_window_default: number;
      read_around_window_max: number;
      read_around_max_chars: number;
      read_file_max_chunks: number;
      read_file_max_chars: number;
    };

    expect(row.read_around_window_default).toBe(1);
    expect(row.read_around_window_max).toBe(3);
    expect(row.read_around_max_chars).toBe(32000);
    expect(row.read_file_max_chunks).toBe(50);
    expect(row.read_file_max_chars).toBe(64000);
    store.db.close();
  });

  it("getContextConfig returns camelCase fields", () => {
    const store = getSettingsStore(
      dbPath,
      makeConfig(dbPath, {
        READ_AROUND_WINDOW_DEFAULT: 2,
        READ_AROUND_WINDOW_MAX: 5,
        READ_AROUND_MAX_CHARS: 16000,
        READ_FILE_MAX_CHUNKS: 25,
        READ_FILE_MAX_CHARS: 32000,
      }),
    );

    expect(store.getContextConfig()).toEqual({
      readAroundWindowDefault: 2,
      readAroundWindowMax: 5,
      readAroundMaxChars: 16000,
      readFileMaxChunks: 25,
      readFileMaxChars: 32000,
    });
    store.db.close();
  });

  it("updateContextConfig persists patch and returns updated config", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));

    const updated = store.updateContextConfig({
      readAroundWindowDefault: 2,
      readAroundMaxChars: 24000,
    });

    expect(updated).toEqual({
      readAroundWindowDefault: 2,
      readAroundWindowMax: 3,
      readAroundMaxChars: 24000,
      readFileMaxChunks: 50,
      readFileMaxChars: 64000,
    });
    expect(store.getContextConfig()).toEqual(updated);
    store.db.close();
  });

  it("migrates v1.0 DB with only chunk columns on init", () => {
    const db = new BetterSqlite3(dbPath);
    db.exec(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        chunk_size INTEGER NOT NULL,
        chunk_overlap INTEGER NOT NULL
      );
      INSERT INTO settings (id, chunk_size, chunk_overlap) VALUES (1, 512, 64);
    `);
    db.close();

    const store = getSettingsStore(dbPath, makeConfig(dbPath));

    expect(store.getContextConfig()).toEqual({
      readAroundWindowDefault: 1,
      readAroundWindowMax: 3,
      readAroundMaxChars: 32000,
      readFileMaxChunks: 50,
      readFileMaxChars: 64000,
    });
    expect(store.getModelConfig()).toEqual({
      embeddingBaseUrl: "https://open.cherryin.cc",
      embeddingModel: "qwen/qwen3-embedding-8b",
      rerankEnabled: false,
      rerankBaseUrl: "https://open.cherryin.cc",
      rerankModel: "qwen/qwen3-reranker-0.6b",
      rerankCandidates: 30,
    });
    store.db.close();
  });

  it("seeds model columns from env defaults on first boot", () => {
    const store = getSettingsStore(
      dbPath,
      makeConfig(dbPath, {
        EMBEDDING_MODEL: "custom/embed",
        RERANK_ENABLED: true,
        RERANK_MODEL: "custom/rerank",
        RERANK_CANDIDATES: 20,
      }),
    );

    expect(store.getModelConfig()).toEqual({
      embeddingBaseUrl: "https://open.cherryin.cc",
      embeddingModel: "custom/embed",
      rerankEnabled: true,
      rerankBaseUrl: "https://open.cherryin.cc",
      rerankModel: "custom/rerank",
      rerankCandidates: 20,
    });
    store.db.close();
  });

  it("updateModelConfig persists patch and returns updated config", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));

    const updated = store.updateModelConfig({
      embeddingBaseUrl: "https://api.example.com/v1",
      embeddingModel: "other/embed",
      rerankEnabled: true,
      rerankBaseUrl: "https://rerank.example.com/v1",
      rerankCandidates: 15,
    });

    expect(updated).toEqual({
      embeddingBaseUrl: "https://api.example.com/v1",
      embeddingModel: "other/embed",
      rerankEnabled: true,
      rerankBaseUrl: "https://rerank.example.com/v1",
      rerankModel: "qwen/qwen3-reranker-0.6b",
      rerankCandidates: 15,
    });
    expect(store.getModelConfig()).toEqual(updated);

    store.db.close();
    const reopened = getSettingsStore(dbPath, makeConfig(dbPath));
    expect(reopened.getModelConfig()).toEqual(updated);
    reopened.db.close();
  });

  it("updateModelConfig rejects invalid candidates and empty model names", () => {
    const store = getSettingsStore(dbPath, makeConfig(dbPath));

    expect(() => store.updateModelConfig({ rerankCandidates: 0 })).toThrow(
      /rerankCandidates/,
    );
    expect(() => store.updateModelConfig({ rerankCandidates: 51 })).toThrow(
      /rerankCandidates/,
    );
    expect(() => store.updateModelConfig({ embeddingModel: "  " })).toThrow(
      /embeddingModel/,
    );
    expect(() => store.updateModelConfig({ rerankModel: "" })).toThrow(
      /rerankModel/,
    );
    expect(() =>
      store.updateModelConfig({ embeddingBaseUrl: "not-a-url" }),
    ).toThrow(/embeddingBaseUrl/);
    expect(() => store.updateModelConfig({ rerankBaseUrl: "ftp://x" })).toThrow(
      /rerankBaseUrl/,
    );

    expect(store.getModelConfig().rerankCandidates).toBe(30);
    store.db.close();
  });

  it("migrates legacy settings table without model columns", () => {
    const db = new BetterSqlite3(dbPath);
    db.exec(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        chunk_size INTEGER NOT NULL,
        chunk_overlap INTEGER NOT NULL,
        read_around_window_default INTEGER NOT NULL DEFAULT 1,
        read_around_window_max INTEGER NOT NULL DEFAULT 3,
        read_around_max_chars INTEGER NOT NULL DEFAULT 32000,
        read_file_max_chunks INTEGER NOT NULL DEFAULT 50,
        read_file_max_chars INTEGER NOT NULL DEFAULT 64000
      );
      INSERT INTO settings (
        id, chunk_size, chunk_overlap,
        read_around_window_default, read_around_window_max,
        read_around_max_chars, read_file_max_chunks, read_file_max_chars
      ) VALUES (1, 512, 64, 1, 3, 32000, 50, 64000);
    `);
    db.close();

    const store = getSettingsStore(
      dbPath,
      makeConfig(dbPath, {
        EMBEDDING_MODEL: "migrated/embed",
        RERANK_ENABLED: true,
        RERANK_MODEL: "migrated/rerank",
        RERANK_CANDIDATES: 25,
      }),
    );

    expect(store.getChunkConfig()).toEqual({
      chunkSize: 512,
      chunkOverlap: 64,
    });
    expect(store.getModelConfig()).toEqual({
      embeddingBaseUrl: "https://open.cherryin.cc",
      embeddingModel: "migrated/embed",
      rerankEnabled: true,
      rerankBaseUrl: "https://open.cherryin.cc",
      rerankModel: "migrated/rerank",
      rerankCandidates: 25,
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
      userId: "test-user",
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
      userId: "test-user",
    });

    registry.deleteDocument("doc-2");
    expect(registry.getDocument("doc-2")).toBeUndefined();

    store.db.close();
  });
});
