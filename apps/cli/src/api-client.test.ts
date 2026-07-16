import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@kb/config";
import { createApiClient } from "./api-client.js";

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
  AUTH_SQLITE_PATH: "./data/sqlite/auth.db",
  BACKEND_HOST: "127.0.0.1",
  BACKEND_PORT: 3000,
  MCP_HTTP_HOST: "127.0.0.1",
  MCP_HTTP_PORT: 3100,
  DEFAULT_COLLECTION: "default",
  EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
  EMBEDDING_DIMENSIONS: 1024,
  RERANK_ENABLED: false,
  RERANK_CANDIDATES: 30,
  AUTH_ENABLED: false,
  USER_AUTH_ENABLED: false,
  JWT_EXPIRES_IN: 604800,
  AUTH_PROVIDER: "cas",
  CAS_MOCK: true,
} as AppConfig;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApiClient", () => {
  it("sends Authorization Bearer when AUTH_ENABLED", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({
      ...baseConfig,
      AUTH_ENABLED: true,
      API_KEY: "secret-key",
    });
    await client.listDocuments();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/v1/documents",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret-key" },
      }),
    );
  });

  it("does not send Authorization when auth disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ ...baseConfig, AUTH_ENABLED: false });
    await client.listDocuments();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/v1/documents",
      expect.objectContaining({ headers: {} }),
    );
  });
});
