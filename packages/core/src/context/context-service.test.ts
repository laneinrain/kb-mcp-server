import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContextError } from "./errors.js";
import {
  ContextService,
  truncateAroundCenter,
  truncateFromEnd,
} from "./context-service.js";
import type { ContextConfig } from "../registry/types.js";
import type { ContextChunk } from "./types.js";

const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  readAroundWindowDefault: 1,
  readAroundWindowMax: 3,
  readAroundMaxChars: 32000,
  readFileMaxChunks: 50,
  readFileMaxChars: 64000,
};

function makeChunkIds(docId: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${docId}:${index}`);
}

function makeHits(
  docId: string,
  filename: string,
  indices: number[],
  textForIndex?: (index: number) => string,
): Array<{
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
}> {
  return indices.map((index) => ({
    documentId: docId,
    filename,
    chunkIndex: index,
    text: textForIndex ? textForIndex(index) : `text-${index}`,
  }));
}

function createService(
  overrides: {
    getDocument?: ReturnType<typeof vi.fn>;
    getChunkIds?: ReturnType<typeof vi.fn>;
    getByIds?: ReturnType<typeof vi.fn>;
    getContextConfig?: ReturnType<typeof vi.fn>;
    defaultCollection?: string;
  } = {},
) {
  const getDocument =
    overrides.getDocument ??
    vi.fn().mockReturnValue({
      id: "doc-1",
      filename: "notes.txt",
      collection: "doc-collection",
    });
  const getChunkIds =
    overrides.getChunkIds ?? vi.fn().mockReturnValue(makeChunkIds("doc-1", 7));
  const getByIds =
    overrides.getByIds ??
    vi.fn().mockImplementation(({ ids }: { ids: string[] }) => {
      const indices = ids.map((id) => Number(id.split(":")[1]));
      return Promise.resolve(makeHits("doc-1", "notes.txt", indices));
    });
  const getContextConfig =
    overrides.getContextConfig ??
    vi.fn().mockReturnValue({ ...DEFAULT_CONTEXT_CONFIG });

  const service = new ContextService(
    { getDocument, getChunkIds } as never,
    { getByIds } as never,
    { getContextConfig } as never,
    overrides.defaultCollection ?? "default",
  );

  return {
    service,
    getDocument,
    getChunkIds,
    getByIds,
    getContextConfig,
  };
}

describe("ContextError", () => {
  it("has code document_not_found and correct name", () => {
    const error = new ContextError("document_not_found", "missing doc");
    expect(error.code).toBe("document_not_found");
    expect(error.name).toBe("ContextError");
    expect(error.message).toBe("missing doc");
  });

  it("has code chunk_index_out_of_range", () => {
    const error = new ContextError("chunk_index_out_of_range", "bad index");
    expect(error.code).toBe("chunk_index_out_of_range");
  });

  it("has code chunks_missing", () => {
    const error = new ContextError("chunks_missing", "drift");
    expect(error.code).toBe("chunks_missing");
  });
});

describe("ReadAroundResult types", () => {
  it("includes windowRequested, windowApplied, and chunkRange fields", () => {
    const result = {
      documentId: "doc-1",
      filename: "notes.txt",
      collection: "default",
      chunkRange: { start: 2, end: 6 },
      windowRequested: 2,
      windowApplied: 2,
      chunks: [] as ContextChunk[],
    };
    expect(result.windowRequested).toBe(2);
    expect(result.windowApplied).toBe(2);
    expect(result.chunkRange).toEqual({ start: 2, end: 6 });
  });
});

describe("truncateAroundCenter", () => {
  it("removes furthest-from-center chunks first with higher-index tie-break", () => {
    const chunks: ContextChunk[] = [
      { documentId: "d", filename: "f", chunkIndex: 0, text: "aa" },
      { documentId: "d", filename: "f", chunkIndex: 1, text: "bb" },
      { documentId: "d", filename: "f", chunkIndex: 2, text: "center" },
      { documentId: "d", filename: "f", chunkIndex: 3, text: "dd" },
      { documentId: "d", filename: "f", chunkIndex: 4, text: "ee" },
    ];

    const { chunks: result, truncated } = truncateAroundCenter(chunks, 2, 10);

    expect(truncated).toBe(true);
    expect(result.map((chunk) => chunk.chunkIndex)).toEqual([1, 2, 3]);
  });

  it("keeps center alone when it exceeds cap and marks truncated", () => {
    const chunks: ContextChunk[] = [
      { documentId: "d", filename: "f", chunkIndex: 2, text: "x".repeat(20) },
    ];

    const { chunks: result, truncated } = truncateAroundCenter(chunks, 2, 10);

    expect(truncated).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toHaveLength(20);
  });
});

describe("truncateFromEnd", () => {
  it("removes highest-index chunks until under char cap", () => {
    const chunks: ContextChunk[] = [
      { documentId: "d", filename: "f", chunkIndex: 0, text: "aaa" },
      { documentId: "d", filename: "f", chunkIndex: 1, text: "bbb" },
      { documentId: "d", filename: "f", chunkIndex: 2, text: "ccc" },
    ];

    const { chunks: result, truncated } = truncateFromEnd(chunks, 5);

    expect(truncated).toBe(true);
    expect(result.map((chunk) => chunk.chunkIndex)).toEqual([0]);
  });
});

describe("ContextService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("readAround center=4 window=2 fetches indices 2–6 (D-01)", async () => {
    const { service, getByIds } = createService();

    const result = await service.readAround("doc-1", 4, { window: 2 });

    expect(getByIds).toHaveBeenCalledWith({
      ids: makeChunkIds("doc-1", 7).slice(2, 7),
      collection: "doc-collection",
    });
    expect(result.chunkRange).toEqual({ start: 2, end: 6 });
    expect(result.chunks.map((chunk) => chunk.chunkIndex)).toEqual([
      2, 3, 4, 5, 6,
    ]);
  });

  it("window=5 with max=3 yields windowApplied=3 without error (D-03)", async () => {
    const { service } = createService({
      getContextConfig: vi.fn().mockReturnValue({
        ...DEFAULT_CONTEXT_CONFIG,
        readAroundWindowMax: 3,
      }),
    });

    const result = await service.readAround("doc-1", 4, { window: 5 });

    expect(result.windowRequested).toBe(5);
    expect(result.windowApplied).toBe(3);
    expect(result.chunkRange).toEqual({ start: 1, end: 6 });
  });

  it("center=0 window=2 shrinks chunkRange to {0,2} (D-04)", async () => {
    const { service } = createService();

    const result = await service.readAround("doc-1", 0, { window: 2 });

    expect(result.chunkRange).toEqual({ start: 0, end: 2 });
    expect(result.chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1, 2]);
  });

  it("returns chunks sorted ascending with center marked isCenter (D-05, D-06)", async () => {
    const { service } = createService({
      getByIds: vi.fn().mockResolvedValue(
        makeHits("doc-1", "notes.txt", [4, 2, 3]).reverse(),
      ),
    });

    const result = await service.readAround("doc-1", 3, { window: 1 });

    expect(result.chunks.map((chunk) => chunk.chunkIndex)).toEqual([2, 3, 4]);
    const center = result.chunks.find((chunk) => chunk.chunkIndex === 3);
    expect(center?.isCenter).toBe(true);
    expect(result.chunks.filter((chunk) => chunk.isCenter)).toHaveLength(1);
  });

  it("char cap removes furthest-from-center first while preserving center (D-08)", async () => {
    const { service } = createService({
      getContextConfig: vi.fn().mockReturnValue({
        ...DEFAULT_CONTEXT_CONFIG,
        readAroundMaxChars: 12,
      }),
      getByIds: vi.fn().mockResolvedValue(
        makeHits("doc-1", "notes.txt", [0, 1, 2, 3, 4], (index) =>
          index === 2 ? "center" : "xxxx",
        ),
      ),
    });

    const result = await service.readAround("doc-1", 2, { window: 2 });

    expect(result.truncated).toBe(true);
    expect(result.chunks.map((chunk) => chunk.chunkIndex)).toEqual([1, 2]);
    expect(result.chunks.find((chunk) => chunk.chunkIndex === 2)?.isCenter).toBe(
      true,
    );
  });

  it("center-only exceeding cap returns full center with truncated true", async () => {
    const { service } = createService({
      getContextConfig: vi.fn().mockReturnValue({
        ...DEFAULT_CONTEXT_CONFIG,
        readAroundMaxChars: 5,
      }),
      getByIds: vi.fn().mockResolvedValue([
        {
          documentId: "doc-1",
          filename: "notes.txt",
          chunkIndex: 2,
          text: "toolong",
        },
      ]),
    });

    const result = await service.readAround("doc-1", 2, { window: 0 });

    expect(result.truncated).toBe(true);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.text).toBe("toolong");
    expect(result.chunks[0]?.isCenter).toBe(true);
  });

  it("unknown document_id throws document_not_found and skips getByIds (CORE-02)", async () => {
    const { service, getByIds } = createService({
      getDocument: vi.fn().mockReturnValue(undefined),
    });

    await expect(service.readAround("missing", 0)).rejects.toMatchObject({
      name: "ContextError",
      code: "document_not_found",
    });
    expect(getByIds).not.toHaveBeenCalled();
  });

  it("out-of-range chunk_index throws and skips getByIds (CORE-02)", async () => {
    const { service, getByIds } = createService({
      getChunkIds: vi.fn().mockReturnValue(makeChunkIds("doc-1", 3)),
    });

    await expect(service.readAround("doc-1", 5)).rejects.toMatchObject({
      name: "ContextError",
      code: "chunk_index_out_of_range",
    });
    expect(getByIds).not.toHaveBeenCalled();
  });

  it("throws chunks_missing when getByIds returns fewer hits than expected", async () => {
    const { service } = createService({
      getByIds: vi.fn().mockResolvedValue(
        makeHits("doc-1", "notes.txt", [3, 4]),
      ),
    });

    await expect(service.readAround("doc-1", 4, { window: 1 })).rejects.toMatchObject(
      {
        name: "ContextError",
        code: "chunks_missing",
      },
    );
  });

  it("readFile applies max chunks then max chars and truncates from tail", async () => {
    const { service, getByIds } = createService({
      getContextConfig: vi.fn().mockReturnValue({
        ...DEFAULT_CONTEXT_CONFIG,
        readFileMaxChunks: 3,
        readFileMaxChars: 8,
      }),
      getChunkIds: vi.fn().mockReturnValue(makeChunkIds("doc-1", 5)),
      getByIds: vi.fn().mockImplementation(({ ids }: { ids: string[] }) => {
        const indices = ids.map((id) => Number(id.split(":")[1]));
        return Promise.resolve(
          makeHits("doc-1", "notes.txt", indices, () => "aaa"),
        );
      }),
    });

    const result = await service.readFile("doc-1");

    expect(getByIds).toHaveBeenCalledWith({
      ids: makeChunkIds("doc-1", 5).slice(0, 3),
      collection: "doc-collection",
    });
    expect(result.chunkCount).toBe(5);
    expect(result.returnedChunks).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
  });

  it("resolves collection as options?.collection ?? doc.collection ?? defaultCollection", async () => {
    const { service, getByIds } = createService();

    await service.readAround("doc-1", 1, { collection: "override" });
    expect(getByIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ collection: "override" }),
    );

    await service.readAround("doc-1", 1);
    expect(getByIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ collection: "doc-collection" }),
    );

    const fallback = createService({
      getDocument: vi.fn().mockReturnValue({
        id: "doc-1",
        filename: "notes.txt",
        collection: undefined,
      }),
    });
    await fallback.service.readAround("doc-1", 1);
    expect(fallback.getByIds).toHaveBeenLastCalledWith(
      expect.objectContaining({ collection: "default" }),
    );
  });

  it("calls getContextConfig on each readAround and readFile (D-13)", async () => {
    const { service, getContextConfig } = createService();

    await service.readAround("doc-1", 1);
    await service.readFile("doc-1");

    expect(getContextConfig).toHaveBeenCalledTimes(2);
  });

  it("ContextService.create factory mirrors SearchService.create", () => {
    const registry = { getDocument: vi.fn(), getChunkIds: vi.fn() } as never;
    const vectorStore = { getByIds: vi.fn() } as never;
    const settingsStore = { getContextConfig: vi.fn() } as never;
    const config = { DEFAULT_COLLECTION: "custom" } as never;

    const service = ContextService.create(config, {
      registry,
      vectorStore,
      settingsStore,
    });

    expect(service).toBeInstanceOf(ContextService);
  });
});
