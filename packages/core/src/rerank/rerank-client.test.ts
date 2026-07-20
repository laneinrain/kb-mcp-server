import { describe, expect, it, vi } from "vitest";
import { loadConfig, type AppConfig } from "@kb/config";
import { RerankError } from "./errors.js";
import { RerankClient } from "./rerank-client.js";

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
  };
}

function jsonResponse(
  body: unknown,
  init?: { status?: number },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function getFetchCall(
  fetchFn: ReturnType<typeof vi.fn>,
  index = 0,
): { url: string; init: RequestInit } {
  const call = fetchFn.mock.calls[index];
  if (!Array.isArray(call) || call.length < 2) {
    throw new Error("expected fetch call");
  }
  return { url: call[0] as string, init: call[1] as RequestInit };
}

describe("RerankClient", () => {
  it("rerank(query, []) returns [] without calling fetch", async () => {
    const fetchFn = vi.fn();
    const client = new RerankClient(makeConfig(), fetchFn);

    await expect(client.rerank("query", [])).resolves.toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps API response and sorts by relevance_score desc", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        results: [
          { index: 1, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.1 },
        ],
      }),
    );
    const client = new RerankClient(makeConfig(), fetchFn);

    const results = await client.rerank("query", ["doc-a", "doc-b"]);

    expect(results).toEqual([
      { index: 1, relevanceScore: 0.9 },
      { index: 0, relevanceScore: 0.1 },
    ]);
  });

  it("passes top_n in request body when options.topN is set", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.5 }] }),
    );
    const client = new RerankClient(makeConfig(), fetchFn);

    await client.rerank("query", ["doc-a"], { topN: 3 });

    const { init } = getFetchCall(fetchFn);
    const body = JSON.parse(String(init.body)) as {
      top_n?: number;
      model: string;
      query: string;
      documents: string[];
    };

    expect(body.top_n).toBe(3);
    expect(body.model).toBe("qwen/qwen3-reranker-0.6b");
    expect(body.query).toBe("query");
    expect(body.documents).toEqual(["doc-a"]);
  });

  it("posts to CHERRYIN_BASE_URL/rerank with bearer auth", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.5 }] }),
    );
    const client = new RerankClient(makeConfig(), fetchFn);

    await client.rerank("what is RAG?", ["chunk"]);

    const { url, init } = getFetchCall(fetchFn);
    expect(url).toBe("https://open.cherryin.cc/v1/rerank");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
  });

  it("uses getBaseUrl resolver when provided", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.5 }] }),
    );
    const client = new RerankClient(makeConfig(), fetchFn, () =>
      "https://custom.rerank/v1",
    );

    await client.rerank("q", ["d"]);

    expect(getFetchCall(fetchFn).url).toBe("https://custom.rerank/v1/rerank");
  });

  it("retries on 429 and succeeds on the next attempt", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, { status: 429 }))
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ index: 0, relevance_score: 0.8 }] }),
      );
    const client = new RerankClient(makeConfig(), fetchFn);

    const results = await client.rerank("query", ["doc"]);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(results).toEqual([{ index: 0, relevanceScore: 0.8 }]);
  });

  it("throws RerankError on non-2xx after retries exhausted", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: "server error" }, { status: 500 }),
    );
    const client = new RerankClient(makeConfig(), fetchFn);

    await expect(client.rerank("query", ["doc"])).rejects.toBeInstanceOf(
      RerankError,
    );
  });

  it("ping() sends a minimal rerank request", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ results: [{ index: 0, relevance_score: 0.5 }] }),
    );
    const client = new RerankClient(makeConfig(), fetchFn);

    await client.ping();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const { init } = getFetchCall(fetchFn);
    const body = JSON.parse(String(init.body)) as {
      query: string;
      documents: string[];
      top_n?: number;
    };
    expect(body.query).toBe("health-check");
    expect(body.documents).toEqual(["health-check"]);
    expect(body.top_n).toBe(1);
  });
});

describe("RerankClient integration", () => {
  const liveKey = process.env.CHERRYIN_API_KEY;
  const baseUrl = process.env.CHERRYIN_BASE_URL ?? "";
  const isLocalMock =
    baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");

  it.skipIf(!liveKey || isLocalMock)(
    "reranks live when CHERRYIN_API_KEY is set",
    async () => {
      const client = new RerankClient(loadConfig());
      const results = await client.rerank(
        "What is the capital of China?",
        ["Beijing is the capital of China.", "Paris is in France."],
        { topN: 1 },
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].index).toBe(0);
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    },
  );
});
