import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { loadConfig, type AppConfig } from "@kb/config";
import { EmbeddingClient } from "./embedding-client.js";

function makeConfig(): AppConfig {
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
    SQLITE_PATH: "./data/sqlite/registry.db",
    DATA_DIR: "./data",
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
    AUTH_SQLITE_PATH: "./data/sqlite/auth.db",
    AUTH_PROVIDER: "cas",
    CAS_MOCK: true,
  };
}

function mockEmbedding(index: number, dimensions = 1024): number[] {
  return Array.from({ length: dimensions }, (_, i) => index + i * 0.001);
}

function createMockClient(
  embedFn?: (input: string[]) => Promise<{ data: { index: number; embedding: number[] }[] }>,
): OpenAI {
  const create = vi.fn(async ({ input }: { input: string[] }) => {
    if (embedFn) {
      return embedFn(Array.isArray(input) ? input : [input]);
    }
    const texts = Array.isArray(input) ? input : [input];
    return {
      data: texts.map((_, index) => ({
        index,
        embedding: mockEmbedding(index),
      })),
    };
  });

  return {
    embeddings: { create },
  } as unknown as OpenAI;
}

describe("EmbeddingClient", () => {
  it("embedDocuments([]) returns []", async () => {
    const client = new EmbeddingClient(makeConfig(), createMockClient());
    await expect(client.embedDocuments([])).resolves.toEqual([]);
  });

  it("embedDocuments batches inputs with max 64 per call", async () => {
    const texts = Array.from({ length: 130 }, (_, i) => `doc-${i}`);
    const mockClient = createMockClient();
    const client = new EmbeddingClient(makeConfig(), mockClient);

    const result = await client.embedDocuments(texts);

    expect(mockClient.embeddings.create).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(130);
  });

  it("embedQuery prepends Qwen3 instruction prefix", () => {
    const client = new EmbeddingClient(makeConfig(), createMockClient());
    const formatted = client.formatQuery("what is RAG?");

    expect(formatted).toBe(
      "Instruct: Given a user question, retrieve relevant passages from the knowledge base\nQuery:what is RAG?",
    );
  });

  it("ping() calls embedDocuments with single short string", async () => {
    const mockClient = createMockClient();
    const client = new EmbeddingClient(makeConfig(), mockClient);
    const spy = vi.spyOn(client, "embedDocuments");

    await client.ping();

    expect(spy).toHaveBeenCalledWith(["health-check"]);
  });
});

describe("EmbeddingClient integration", () => {
  it.skipIf(!process.env.CHERRYIN_API_KEY)(
    "embeds live when CHERRYIN_API_KEY is set",
    async () => {
      const client = new EmbeddingClient(loadConfig());
      const [vector] = await client.embedDocuments(["integration smoke"]);
      expect(vector).toHaveLength(1024);
    },
  );
});
