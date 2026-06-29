import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DocumentRegistry } from "../registry/document-registry.js";
import type { SettingsStore } from "../registry/settings-store.js";
import { IngestionService } from "./ingestion-service.js";

vi.mock("./parsers/index.js", () => ({
  parseDocument: vi.fn(),
}));

vi.mock("./chunker.js", () => ({
  chunkText: vi.fn(),
}));

import { parseDocument } from "./parsers/index.js";
import { chunkText } from "./chunker.js";

const parseDocumentMock = vi.mocked(parseDocument);
const chunkTextMock = vi.mocked(chunkText);

function createRegistryMock(existing?: { id: string }) {
  return {
    registerDocument: vi.fn(),
    updateStatus: vi.fn(),
    getDocument: vi.fn().mockReturnValue(existing),
    listDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    trackChunkIds: vi.fn(),
    getChunkIds: vi.fn(),
  } as unknown as DocumentRegistry;
}

describe("IngestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseDocumentMock.mockResolvedValue({
      text: "parsed document body",
      mimeType: "text/plain",
      filename: "sample.txt",
    });
    chunkTextMock.mockResolvedValue(["chunk-a", "chunk-b"]);
  });

  it("ingest() calls parseDocument → chunkText → embedDocuments → upsertChunks", async () => {
    const registry = createRegistryMock();
    const embedDocuments = vi.fn().mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const upsertChunks = vi.fn().mockResolvedValue(["doc:0", "doc:1"]);
    const embeddingClient = { embedDocuments } as never;
    const vectorStore = {
      deleteByDocumentId: vi.fn(),
      upsertChunks,
    } as never;
    const settingsStore = {
      getChunkConfig: vi.fn().mockReturnValue({
        chunkSize: 512,
        chunkOverlap: 64,
      }),
    } as unknown as SettingsStore;

    const service = new IngestionService(
      registry,
      vectorStore,
      embeddingClient,
      settingsStore,
      "default",
    );

    const result = await service.ingest("scripts/fixtures/sample.txt");

    expect(parseDocumentMock).toHaveBeenCalled();
    expect(chunkTextMock).toHaveBeenCalledWith(
      "parsed document body",
      { chunkSize: 512, chunkOverlap: 64 },
    );
    expect(embedDocuments).toHaveBeenCalledWith(["chunk-a", "chunk-b"]);
    expect(upsertChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: ["chunk-a", "chunk-b"],
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        collection: "default",
      }),
    );
    expect(result.chunkCount).toBe(2);
  });

  it("re-ingest same path calls deleteByDocumentId before upsert", async () => {
    const registry = createRegistryMock({ id: "existing-doc" });
    const callOrder: string[] = [];
    const deleteByDocumentId = vi.fn(async () => {
      callOrder.push("delete");
    });
    const upsertChunks = vi.fn(async () => {
      callOrder.push("upsert");
      return ["doc:0"];
    });
    const embedDocuments = vi.fn().mockResolvedValue([[0.1]]);
    chunkTextMock.mockResolvedValue(["chunk-a"]);

    const service = new IngestionService(
      registry,
      { deleteByDocumentId, upsertChunks } as never,
      { embedDocuments } as never,
    );

    await service.ingest("scripts/fixtures/sample.txt");

    expect(deleteByDocumentId).toHaveBeenCalled();
    expect(callOrder).toEqual(["delete", "upsert"]);
  });

  it("uses stable document_id derived from normalized absolute path", async () => {
    const registry = createRegistryMock();
    const upsertChunks = vi.fn().mockResolvedValue(["id:0"]);
    const service = new IngestionService(
      registry,
      {
        deleteByDocumentId: vi.fn(),
        upsertChunks,
      } as never,
      { embedDocuments: vi.fn().mockResolvedValue([[0.1]]) } as never,
    );

    const first = await service.ingest("scripts/fixtures/sample.txt");
    const second = await service.ingest("scripts/fixtures/sample.txt");

    expect(first.documentId).toBe(second.documentId);
    expect(first.documentId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("transitions registry status pending → processing → indexed after embed succeeds", async () => {
    const registry = createRegistryMock() as DocumentRegistry & {
      registerDocument: ReturnType<typeof vi.fn>;
      updateStatus: ReturnType<typeof vi.fn>;
    };
    const upsertChunks = vi.fn().mockResolvedValue(["id:0", "id:1"]);
    const service = new IngestionService(
      registry,
      {
        deleteByDocumentId: vi.fn(),
        upsertChunks,
      } as never,
      {
        embedDocuments: vi.fn().mockResolvedValue([[0.1], [0.2]]),
      } as never,
    );

    await service.ingest("scripts/fixtures/sample.txt");

    expect(registry.registerDocument).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
    expect(registry.updateStatus).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      "processing",
    );
    expect(registry.updateStatus).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      "indexed",
      2,
    );
  });

  it("passes collection option to ChromaVectorStore", async () => {
    const registry = createRegistryMock({ id: "existing-doc" });
    const deleteByDocumentId = vi.fn();
    const upsertChunks = vi.fn().mockResolvedValue(["id:0"]);
    const service = new IngestionService(
      registry,
      { deleteByDocumentId, upsertChunks } as never,
      { embedDocuments: vi.fn().mockResolvedValue([[0.1]]) } as never,
    );

    await service.ingest("scripts/fixtures/sample.txt", {
      collection: "research",
    });

    expect(deleteByDocumentId).toHaveBeenCalledWith(
      expect.any(String),
      "research",
    );
    expect(upsertChunks).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "research" }),
    );
  });
});
