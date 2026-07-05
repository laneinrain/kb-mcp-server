import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@kb/config";
import {
  ALLOWED_EXTENSIONS,
  ingestSingleFile,
  runIngest,
  type IngestDeps,
} from "./ingest.js";
import type { ApiClient } from "../api-client.js";

const baseConfig = {
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
  SQLITE_PATH: "./data/sqlite/registry.db",
  DATA_DIR: "./data",
  BACKEND_HOST: "127.0.0.1",
  BACKEND_PORT: 3000,
  MCP_HTTP_HOST: "127.0.0.1",
  MCP_HTTP_PORT: 3100,
  DEFAULT_COLLECTION: "default",
  EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
  EMBEDDING_DIMENSIONS: 1024,
  AUTH_ENABLED: false,
} as AppConfig;

function makeDeps(overrides: Partial<IngestDeps>): IngestDeps {
  return {
    config: baseConfig,
    apiClient: {
      listDocuments: vi.fn(),
      deleteDocument: vi.fn(),
      uploadDocument: vi.fn(),
      search: vi.fn(),
    } as unknown as ApiClient,
    ingestDirect: vi.fn(),
    ...overrides,
  };
}

describe("ALLOWED_EXTENSIONS", () => {
  it("matches backend allowlist", () => {
    expect(ALLOWED_EXTENSIONS.has(".txt")).toBe(true);
    expect(ALLOWED_EXTENSIONS.has(".md")).toBe(true);
    expect(ALLOWED_EXTENSIONS.has(".markdown")).toBe(true);
    expect(ALLOWED_EXTENSIONS.has(".pdf")).toBe(true);
    expect(ALLOWED_EXTENSIONS.has(".docx")).toBe(false);
  });
});

describe("ingestSingleFile path selection", () => {
  it("uses uploadDocument when AUTH_ENABLED is true", async () => {
    const uploadDocument = vi.fn().mockResolvedValue({
      documentId: "doc-1",
      chunkCount: 3,
      collection: "default",
      status: "indexed",
      outcome: "created",
    });
    const ingestDirect = vi.fn();
    const logs: string[] = [];

    const deps = makeDeps({
      config: { ...baseConfig, AUTH_ENABLED: true, API_KEY: "secret" },
      apiClient: {
        uploadDocument,
      } as unknown as ApiClient,
      ingestDirect,
    });

    const result = await ingestSingleFile(
      "sample.txt",
      "default",
      deps,
      (line) => logs.push(line),
    );

    expect(result).toEqual({ ok: true });
    expect(uploadDocument).toHaveBeenCalledWith("sample.txt", "default");
    expect(ingestDirect).not.toHaveBeenCalled();
    expect(logs.some((line) => line.includes("ingesting sample.txt"))).toBe(
      true,
    );
    expect(logs.some((line) => line.includes('"outcome":"created"'))).toBe(
      true,
    );
  });

  it("logs outcome from direct ingest", async () => {
    const uploadDocument = vi.fn();
    const ingestDirect = vi.fn().mockResolvedValue({
      documentId: "doc-2",
      chunkCount: 1,
      collection: "default",
      outcome: "unchanged",
    });
    const logs: string[] = [];

    const deps = makeDeps({
      config: { ...baseConfig, AUTH_ENABLED: false },
      apiClient: {
        uploadDocument,
      } as unknown as ApiClient,
      ingestDirect,
    });

    await ingestSingleFile("sample.txt", undefined, deps, (line) =>
      logs.push(line),
    );

    expect(logs.some((line) => line.includes('"outcome":"unchanged"'))).toBe(
      true,
    );
  });

  it("uses direct core ingest when AUTH_ENABLED is false", async () => {
    const uploadDocument = vi.fn();
    const ingestDirect = vi.fn().mockResolvedValue({
      documentId: "doc-2",
      chunkCount: 1,
      collection: "default",
      outcome: "created",
    });

    const deps = makeDeps({
      config: { ...baseConfig, AUTH_ENABLED: false },
      apiClient: {
        uploadDocument,
      } as unknown as ApiClient,
      ingestDirect,
    });

    const result = await ingestSingleFile("sample.txt", undefined, deps);

    expect(result).toEqual({ ok: true });
    expect(ingestDirect).toHaveBeenCalledWith("sample.txt", undefined);
    expect(uploadDocument).not.toHaveBeenCalled();
  });
});

describe("runIngest USER_AUTH guard", () => {
  it("exits with code 2 when USER_AUTH_ENABLED without AUTH_ENABLED", async () => {
    const deps = makeDeps({
      config: {
        ...baseConfig,
        USER_AUTH_ENABLED: true,
        AUTH_ENABLED: false,
      },
    });

    const exitCode = await runIngest("sample.txt", undefined, deps);

    expect(exitCode).toBe(2);
  });
});
