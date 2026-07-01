import { describe, expect, it, vi, beforeEach } from "vitest";
import { SearchService } from "./search-service.js";

describe("SearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("search() calls embedQuery then vectorStore.query with default topK=5", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2]);
    const query = vi.fn().mockResolvedValue([
      {
        documentId: "abc",
        filename: "doc.txt",
        chunkIndex: 0,
        text: "snippet",
        distance: 0.15,
      },
    ]);
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
      {
        documentId: "abc",
        filename: "doc.txt",
        chunkIndex: 0,
        text: "snippet",
        distance: 0.333333,
      },
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
    const query = vi.fn().mockResolvedValue([
      {
        documentId: "abc",
        filename: "doc.txt",
        chunkIndex: 0,
        text: longText,
        distance: 0.1,
      },
    ]);
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

  it("SearchService.create factory mirrors IngestionService.create", () => {
    const vectorStore = { query: vi.fn() } as never;
    const embeddingClient = { embedQuery: vi.fn() } as never;
    const config = {
      DEFAULT_COLLECTION: "custom",
    } as never;

    const service = SearchService.create(config, {
      vectorStore,
      embeddingClient,
    });

    expect(service).toBeInstanceOf(SearchService);
  });
});
