import { describe, expect, it, vi, beforeEach } from "vitest";
import { RerankError } from "../rerank/errors.js";
import { SearchService } from "./search-service.js";

function makeHit(
  overrides: Partial<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    text: string;
    distance: number;
  }> = {},
) {
  return {
    documentId: "abc",
    filename: "doc.txt",
    chunkIndex: 0,
    text: "snippet",
    distance: 0.15,
    ...overrides,
  };
}

describe("SearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("search() calls embedQuery then vectorStore.query with default topK=5", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2]);
    const query = vi.fn().mockResolvedValue([makeHit()]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
    );

    const results = await service.search("what is RAG?");

    expect(embedQuery).toHaveBeenCalledWith("what is RAG?");
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 5, collection: "default" }),
    );
    expect(results[0]?.documentId).toBe("abc");
  });

  it("topK above 10 is clamped to 10", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
    );

    await service.search("query", { topK: 25 });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 10 }),
    );
  });

  it("collection option forwarded to vectorStore.query", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
    );

    await service.search("query", { collection: "archive" });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "archive" }),
    );
  });

  it("score = clamp(1 - distance, 0, 1) rounded to 4 decimals", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([
      makeHit({ distance: 0.333333 }),
    ]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
    );

    const results = await service.search("query");

    expect(results[0]?.score).toBe(0.6667);
  });

  it("text truncated to 500 chars with trailing ellipsis when longer", async () => {
    const longText = "a".repeat(600);
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit({ text: longText })]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
    );

    const results = await service.search("query");

    expect(results[0]?.text).toHaveLength(501);
    expect(results[0]?.text.endsWith("…")).toBe(true);
    expect(results[0]?.text.startsWith("a".repeat(500))).toBe(true);
  });

  it("SearchService.create factory wires rerank when enabled", () => {
    const vectorStore = { query: vi.fn() } as never;
    const embeddingClient = { embedQuery: vi.fn() } as never;
    const rerankClient = { rerank: vi.fn() } as never;
    const config = {
      DEFAULT_COLLECTION: "custom",
      RERANK_ENABLED: true,
      RERANK_CANDIDATES: 30,
      RERANK_MODEL: "qwen/qwen3-reranker-0.6b",
    } as never;

    const service = SearchService.create(config, {
      vectorStore,
      embeddingClient,
      rerankClient,
    });

    expect(service).toBeInstanceOf(SearchService);
  });

  it("recalls RERANK_CANDIDATES when rerank enabled", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit()]);
    const rerank = vi.fn().mockResolvedValue([{ index: 0, relevanceScore: 0.95 }]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
      { client: { rerank } as never, enabled: true, candidates: 30, model: "qwen/qwen3-reranker-0.6b" },
    );

    await service.search("query", { topK: 5 });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 30 }),
    );
  });

  it("uses rerank relevance_score and full chunk text for rerank input", async () => {
    const fullText = "b".repeat(600);
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit({ text: fullText })]);
    const rerank = vi.fn().mockResolvedValue([{ index: 0, relevanceScore: 0.87654 }]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
      { client: { rerank } as never, enabled: true, candidates: 30, model: "qwen/qwen3-reranker-0.6b" },
    );

    const results = await service.search("query");

    expect(rerank).toHaveBeenCalledWith("query", [fullText], {
      topN: 5,
      model: "qwen/qwen3-reranker-0.6b",
    });
    expect(results[0]?.score).toBe(0.8765);
    expect(results[0]?.text).toHaveLength(501);
  });

  it("filters ACL before rerank", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([
      makeHit({ documentId: "denied", text: "denied chunk" }),
      makeHit({ documentId: "allowed", text: "allowed chunk", chunkIndex: 1 }),
    ]);
    const rerank = vi.fn().mockResolvedValue([{ index: 0, relevanceScore: 0.9 }]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
      { client: { rerank } as never, enabled: true, candidates: 30, model: "qwen/qwen3-reranker-0.6b" },
    );

    const results = await service.search("query", {
      allowedDocumentIds: new Set(["allowed"]),
    });

    expect(rerank).toHaveBeenCalledWith("query", ["allowed chunk"], {
      topN: 5,
      model: "qwen/qwen3-reranker-0.6b",
    });
    expect(results[0]?.documentId).toBe("allowed");
  });

  it("falls back to vector ranking when rerank fails", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit({ distance: 0.2 })]);
    const rerank = vi.fn().mockRejectedValue(new RerankError("down", 503));
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
      { client: { rerank } as never, enabled: true, candidates: 30, model: "qwen/qwen3-reranker-0.6b" },
    );

    const results = await service.search("query");

    expect(results[0]?.score).toBe(0.8);
  });

  it("SearchService.create skips rerank when RERANK_ENABLED is false", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit()]);
    const rerank = vi.fn();
    const config = {
      DEFAULT_COLLECTION: "default",
      RERANK_ENABLED: false,
      RERANK_CANDIDATES: 30,
      RERANK_MODEL: "qwen/qwen3-reranker-0.6b",
    } as never;

    const service = SearchService.create(config, {
      vectorStore: { query } as never,
      embeddingClient: { embedQuery } as never,
      rerankClient: { rerank } as never,
    });

    await service.search("query");

    expect(query).toHaveBeenCalledWith(expect.objectContaining({ topK: 5 }));
    expect(rerank).not.toHaveBeenCalled();
  });

  it("passes configured rerank model to RerankClient", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit({ text: "chunk" })]);
    const rerank = vi.fn().mockResolvedValue([{ index: 0, relevanceScore: 0.9 }]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
      {
        client: { rerank } as never,
        enabled: true,
        candidates: 30,
        model: "custom/rerank-model",
      },
    );

    await service.search("query");

    expect(rerank).toHaveBeenCalledWith("query", ["chunk"], {
      topN: 5,
      model: "custom/rerank-model",
    });
  });

  it("reads settingsStore.getModelConfig per search when wired via create", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1]);
    const query = vi.fn().mockResolvedValue([makeHit({ text: "chunk" })]);
    const rerank = vi.fn().mockResolvedValue([{ index: 0, relevanceScore: 0.9 }]);
    const modelState = {
      embeddingBaseUrl: "https://embed.example/v1",
      embeddingModel: "embed",
      rerankEnabled: true,
      rerankBaseUrl: "https://rerank.example/v1",
      rerankModel: "settings/rerank",
      rerankCandidates: 30,
    };
    const settingsStore = {
      getModelConfig: vi.fn(() => ({ ...modelState })),
    };
    const config = {
      DEFAULT_COLLECTION: "default",
      RERANK_ENABLED: false,
      RERANK_CANDIDATES: 10,
      RERANK_MODEL: "env/rerank",
      EMBEDDING_MODEL: "env/embed",
    } as never;

    const service = SearchService.create(config, {
      vectorStore: { query } as never,
      embeddingClient: { embedQuery } as never,
      rerankClient: { rerank } as never,
      settingsStore,
    });

    await service.search("query");
    expect(rerank).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ topK: 30 }));

    modelState.rerankEnabled = false;
    rerank.mockClear();
    query.mockClear();
    await service.search("query");
    expect(rerank).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ topK: 5 }));
  });
});
