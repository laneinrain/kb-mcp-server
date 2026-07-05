import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppConfig } from "@kb/config";
import { getDocumentRegistry } from "./document-registry.js";
import { runRegistryMigrations } from "./migrations.js";
import { getSettingsStore } from "./settings-store.js";

function makeConfig(dbPath: string): AppConfig {
  return {
    CHERRYIN_API_KEY: "test-key",
    CHERRYIN_BASE_URL: "https://open.cherryin.cc/v1",
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
    DEFAULT_COLLECTION: "default",
    EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
    EMBEDDING_DIMENSIONS: 1024,
    AUTH_ENABLED: false,
    USER_AUTH_ENABLED: false,
    JWT_EXPIRES_IN: 604800,
    AUTH_SQLITE_PATH: "./data/sqlite/auth.db",
    AUTH_PROVIDER: "cas",
    CAS_MOCK: true,
  };
}

describe("runRegistryMigrations", () => {
  let tempDir: string;

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("backfills legacy rows to system user", () => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-registry-migrate-"));
    const dbPath = join(tempDir, "registry.db");
    const store = getSettingsStore(dbPath, makeConfig(dbPath));
    const registry = getDocumentRegistry(store.db);

    store.db.exec(`
      INSERT INTO documents (
        id, filename, source_path, mime_type, status, chunk_count, collection
      ) VALUES (
        'legacy-1', 'old.txt', '/data/old.txt', 'text/plain', 'indexed', 1, 'default'
      )
    `);

    const migrated = runRegistryMigrations(store.db, "system-user-id");
    expect(migrated).toBe(1);

    const doc = registry.getDocument("legacy-1");
    expect(doc?.userId).toBe("system-user-id");

    store.db.close();
  });

  it("listDocumentsForUser includes own and system docs", () => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-registry-scope-"));
    const dbPath = join(tempDir, "registry.db");
    const systemUserId = "system-user-id";
    const store = getSettingsStore(dbPath, makeConfig(dbPath), {
      systemUserId,
    });
    const registry = getDocumentRegistry(store.db);

    registry.registerDocument({
      id: "user-doc",
      filename: "mine.txt",
      sourcePath: "/data/mine.txt",
      mimeType: "text/plain",
      collection: "default",
      userId: "user-a",
    });
    registry.registerDocument({
      id: "system-doc",
      filename: "legacy.txt",
      sourcePath: "/data/legacy.txt",
      mimeType: "text/plain",
      collection: "default",
      userId: systemUserId,
    });
    registry.registerDocument({
      id: "other-doc",
      filename: "other.txt",
      sourcePath: "/data/other.txt",
      mimeType: "text/plain",
      collection: "default",
      userId: "user-b",
    });

    const visible = registry.listDocumentsForUser("user-a", systemUserId);
    expect(visible.map((doc) => doc.id).sort()).toEqual(["system-doc", "user-doc"]);

    store.db.close();
  });
});
