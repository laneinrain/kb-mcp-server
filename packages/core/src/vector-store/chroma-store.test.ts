import { describe, expect, it, vi } from "vitest";
import type { Collection } from "chromadb";
import { ChromaVectorStore, buildChunkId } from "./chroma-store.js";

describe("ChromaVectorStore", () => {
  it("buildChunkId returns documentId:chunkIndex format", () => {
    expect(buildChunkId("abc-123", 0)).toBe("abc-123:0");
    expect(buildChunkId("abc-123", 42)).toBe("abc-123:42");
  });

  it("deleteByDocumentId calls collection.delete with document_id filter", async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const collection = { delete: deleteMock } as unknown as Collection;
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
        DEFAULT_COLLECTION: "default",
        EMBEDDING_MODEL: "qwen/qwen3-embedding-8b",
        EMBEDDING_DIMENSIONS: 1024,
      },
      {
        heartbeat: vi.fn(),
        getOrCreateCollection: vi.fn().mockResolvedValue(collection),
      } as never,
    );

    await store.deleteByDocumentId("doc-99");

    expect(deleteMock).toHaveBeenCalledWith({
      where: { document_id: "doc-99" },
    });
  });
});

// @vitest-environment node
// Integration test with live Chroma sidecar is deferred to Plan 03 restart verification.
