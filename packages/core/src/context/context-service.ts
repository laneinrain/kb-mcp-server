import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import type { ChromaVectorStore, ChunkHit } from "../vector-store/chroma-store.js";
import type { DocumentRegistry } from "../registry/document-registry.js";
import type { SettingsStore } from "../registry/settings-store.js";
import { contextError } from "./errors.js";
import type {
  ContextChunk,
  ReadAroundOptions,
  ReadAroundResult,
  ReadFileOptions,
  ReadFileResult,
} from "./types.js";

export function truncateAroundCenter(
  chunks: ContextChunk[],
  centerIndex: number,
  maxChars: number,
): { chunks: ContextChunk[]; truncated: boolean } {
  let selected = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  let total = selected.reduce((sum, chunk) => sum + chunk.text.length, 0);
  if (total <= maxChars) {
    return { chunks: selected, truncated: false };
  }

  const byDistance = (chunk: ContextChunk) =>
    Math.abs(chunk.chunkIndex - centerIndex);
  let truncated = false;

  while (total > maxChars && selected.length > 1) {
    const removable = selected.filter(
      (chunk) => chunk.chunkIndex !== centerIndex,
    );
    if (removable.length === 0) {
      break;
    }

    removable.sort((a, b) => {
      const dist = byDistance(b) - byDistance(a);
      return dist !== 0 ? dist : b.chunkIndex - a.chunkIndex;
    });

    const toRemove = removable[0]!;
    total -= toRemove.text.length;
    selected = selected.filter(
      (chunk) => chunk.chunkIndex !== toRemove.chunkIndex,
    );
    truncated = true;
  }

  if (total > maxChars) {
    truncated = true;
  }

  return {
    chunks: selected.sort((a, b) => a.chunkIndex - b.chunkIndex),
    truncated,
  };
}

export function truncateFromEnd(
  chunks: ContextChunk[],
  maxChars: number,
): { chunks: ContextChunk[]; truncated: boolean } {
  let selected = [...chunks];
  let total = selected.reduce((sum, chunk) => sum + chunk.text.length, 0);
  if (total <= maxChars) {
    return { chunks: selected, truncated: false };
  }

  while (total > maxChars && selected.length > 0) {
    const last = selected[selected.length - 1]!;
    total -= last.text.length;
    selected.pop();
  }

  return { chunks: selected, truncated: true };
}

function hitsToContextChunks(
  hits: ChunkHit[],
  centerIndex?: number,
): ContextChunk[] {
  return hits
    .map((hit) => ({
      documentId: hit.documentId,
      filename: hit.filename,
      chunkIndex: hit.chunkIndex,
      text: hit.text,
      ...(centerIndex !== undefined && hit.chunkIndex === centerIndex
        ? { isCenter: true }
        : {}),
    }))
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export class ContextService {
  constructor(
    private readonly registry: DocumentRegistry,
    private readonly vectorStore: ChromaVectorStore,
    private readonly settingsStore: SettingsStore,
    private readonly defaultCollection: string = DEFAULT_COLLECTION,
  ) {}

  static create(
    config: AppConfig,
    deps: {
      registry: DocumentRegistry;
      vectorStore: ChromaVectorStore;
      settingsStore: SettingsStore;
    },
  ): ContextService {
    return new ContextService(
      deps.registry,
      deps.vectorStore,
      deps.settingsStore,
      config.DEFAULT_COLLECTION,
    );
  }

  private assertDocumentAllowed(
    documentId: string,
    allowedDocumentIds?: ReadonlySet<string>,
  ): void {
    if (allowedDocumentIds && !allowedDocumentIds.has(documentId)) {
      throw contextError(
        "document_not_found",
        `Document ${documentId} not found`,
      );
    }
  }

  async readAround(
    documentId: string,
    chunkIndex: number,
    options?: ReadAroundOptions,
  ): Promise<ReadAroundResult> {
    const settings = this.settingsStore.getContextConfig();

    const doc = this.registry.getDocument(documentId);
    if (!doc) {
      throw contextError(
        "document_not_found",
        `Document ${documentId} not found`,
      );
    }

    this.assertDocumentAllowed(documentId, options?.allowedDocumentIds);

    const chromaIds = this.registry.getChunkIds(documentId);
    if (chunkIndex < 0 || chunkIndex >= chromaIds.length) {
      throw contextError(
        "chunk_index_out_of_range",
        `Chunk index ${chunkIndex} out of range`,
      );
    }

    const collection =
      options?.collection ?? doc.collection ?? this.defaultCollection;
    const windowRequested =
      options?.window ?? settings.readAroundWindowDefault;
    const windowApplied = Math.min(
      windowRequested,
      settings.readAroundWindowMax,
    );

    const start = Math.max(0, chunkIndex - windowApplied);
    const end = Math.min(chromaIds.length - 1, chunkIndex + windowApplied);
    const idsToFetch = chromaIds.slice(start, end + 1);

    const hits = await this.vectorStore.getByIds({
      ids: idsToFetch,
      collection,
    });

    if (hits.length < idsToFetch.length) {
      throw contextError(
        "chunks_missing",
        `Expected ${idsToFetch.length} chunks but Chroma returned ${hits.length}`,
      );
    }

    let chunks = hitsToContextChunks(hits, chunkIndex);
    const { chunks: truncatedChunks, truncated } = truncateAroundCenter(
      chunks,
      chunkIndex,
      settings.readAroundMaxChars,
    );
    chunks = truncatedChunks;

    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

    return {
      documentId: doc.id,
      filename: doc.filename,
      collection,
      chunkRange: { start, end },
      windowRequested,
      windowApplied,
      ...(truncated ? { truncated: true } : {}),
      totalChars,
      chunks,
    };
  }

  async readFile(
    documentId: string,
    options?: ReadFileOptions,
  ): Promise<ReadFileResult> {
    const settings = this.settingsStore.getContextConfig();

    const doc = this.registry.getDocument(documentId);
    if (!doc) {
      throw contextError(
        "document_not_found",
        `Document ${documentId} not found`,
      );
    }

    this.assertDocumentAllowed(documentId, options?.allowedDocumentIds);

    const chromaIds = this.registry.getChunkIds(documentId);
    const collection =
      options?.collection ?? doc.collection ?? this.defaultCollection;

    const idsToFetch = chromaIds.slice(0, settings.readFileMaxChunks);

    const hits = await this.vectorStore.getByIds({
      ids: idsToFetch,
      collection,
    });

    if (hits.length < idsToFetch.length) {
      throw contextError(
        "chunks_missing",
        `Expected ${idsToFetch.length} chunks but Chroma returned ${hits.length}`,
      );
    }

    let chunks = hitsToContextChunks(hits);
    const { chunks: truncatedChunks, truncated } = truncateFromEnd(
      chunks,
      settings.readFileMaxChars,
    );
    chunks = truncatedChunks;

    return {
      documentId: doc.id,
      filename: doc.filename,
      collection,
      chunkCount: chromaIds.length,
      returnedChunks: chunks.length,
      ...(truncated || chunks.length < chromaIds.length
        ? { truncated: true }
        : {}),
      chunks,
    };
  }
}
