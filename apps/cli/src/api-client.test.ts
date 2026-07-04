import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client.js";

const baseConfig = {
  CHERRYIN_API_KEY: "test-key",
  CHERRYIN_BASE_URL: "https://open.cherryin.cc/v1",
  CHROMA_HOST: "localhost",
  CHROMA_PORT: 8000,
  CHUNK_SIZE: 1024,
  CHUNK_OVERLAP: 154,
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
} as const;

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
