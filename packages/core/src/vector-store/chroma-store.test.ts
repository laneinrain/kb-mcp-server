import { describe, expect, it, vi } from "vitest";
import type { Collection } from "chromadb";
import { ChromaVectorStore, buildChunkId } from "./chroma-store.js";

describe("ChromaVectorStore", () => {
  it("buildChunkId returns documentId:chunkIndex format", () => {
    expect(buildChunkId("abc-123", 0)).toBe("abc-123:0");
    expect(buildChunkId("abc-123", 42)).toBe("abc-123:42");
  });

  it("getOrCreateCollection disables Chroma default embedding function", async () => {
    const getOrCreateCollection = vi.fn().mockResolvedValue({} as Collection);
    const store = new ChromaVectorStore(
      {
        CHERRYIN_API_KEY: "test-key",
        CHERRYIN_BASE_URL: "https://open.cherryin.cc",
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
      },
      {
        heartbeat: vi.fn(),
        getOrCreateCollection,
      } as never,
    );

    await store.getOrCreateCollection();

    expect(getOrCreateCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "default",
        embeddingFunction: null,
      }),
    );
  });

  it("deleteByDocumentId calls collection.delete with document_id filter", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const collection = { delete: deleteMock } as unknown as Collection;
    const getOrCreateCollection = vi.fn().mockResolvedValue(collection);
    const store = new ChromaVectorStore(
      {
        CHERRYIN_API_KEY: "test-key",
        CHERRYIN_BASE_URL: "https://open.cherryin.cc",
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
      },
      {
        heartbeat: vi.fn(),
        getOrCreateCollection,
      } as never,
    );

    await store.deleteByDocumentId("doc-99");

    expect(deleteMock).toHaveBeenCalledWith({
      where: { document_id: "doc-99" },
    });
  });

  it("query() calls collection.query with queryEmbeddings and maps metadata", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      ids: [["doc-1:0"]],
      documents: [["hello world"]],
      metadatas: [[{ document_id: "doc-1", filename: "sample.txt", chunk_index: 0 }]],
      distances: [[0.25]],
    });
    const collection = { query: queryMock } as unknown as Collection;
    const getOrCreateCollection = vi.fn().mockResolvedValue(collection);
    const store = new ChromaVectorStore(
      {
        CHERRYIN_API_KEY: "test-key",
        CHERRYIN_BASE_URL: "https://open.cherryin.cc",
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
      },
      {
        heartbeat: vi.fn(),
        getOrCreateCollection,
      } as never,
    );

    const hits = await store.query({
      embedding: [0.1, 0.2],
      topK: 5,
    });

    expect(queryMock).toHaveBeenCalledWith({
      queryEmbeddings: [[0.1, 0.2]],
      nResults: 5,
      include: expect.arrayContaining(["documents", "metadatas", "distances"]),
    });
    expect(hits).toEqual([
      {
        documentId: "doc-1",
        filename: "sample.txt",
        chunkIndex: 0,
        text: "hello world",
        distance: 0.25,
      },
    ]);
  });

  it("query() passes optional collection to getOrCreateCollection", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      ids: [[]],
      documents: [[]],
      metadatas: [[]],
      distances: [[]],
    });
    const collection = { query: queryMock } as unknown as Collection;
    const getOrCreateCollection = vi.fn().mockResolvedValue(collection);
    const store = new ChromaVectorStore(
      {
        CHERRYIN_API_KEY: "test-key",
        CHERRYIN_BASE_URL: "https://open.cherryin.cc",
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
      },
      {
        heartbeat: vi.fn(),
        getOrCreateCollection,
      } as never,
    );

    await store.query({
      embedding: [0.1],
      topK: 3,
      collection: "custom",
    });

    expect(getOrCreateCollection).toHaveBeenCalledWith(
      expect.objectContaining({ name: "custom" }),
    );
  });

  it("query() returns empty array when Chroma returns no hits", async () => {
    const queryMock = vi.fn().mockResolvedValue({
      ids: [[]],
      documents: [[]],
      metadatas: [[]],
      distances: [[]],
    });
    const collection = { query: queryMock } as unknown as Collection;
    const getOrCreateCollection = vi.fn().mockResolvedValue(collection);
    const store = new ChromaVectorStore(
      {
        CHERRYIN_API_KEY: "test-key",
        CHERRYIN_BASE_URL: "https://open.cherryin.cc",
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
      },
      {
        heartbeat: vi.fn(),
        getOrCreateCollection,
      } as never,
    );

    const hits = await store.query({ embedding: [0.1], topK: 5 });

    expect(hits).toEqual([]);
  });
});

// @vitest-environment node
// Integration test with live Chroma sidecar is deferred to Plan 03 restart verification.
