import { normalize, resolve } from "node:path";
import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import { EmbeddingClient } from "../embeddings/embedding-client.js";
import type { DocumentRegistry } from "../registry/document-registry.js";
import type { SettingsStore } from "../registry/settings-store.js";
import { ChromaVectorStore } from "../vector-store/chroma-store.js";
import { chunkText } from "./chunker.js";
import {
  computeContentHash,
  deriveDocumentIdForUserFile,
} from "./content-hash.js";
import { parseDocument } from "./parsers/index.js";

export interface IngestOptions {
  collection?: string;
  /** Original upload filename when temp path includes a storage prefix */
  filename?: string;
  userId?: string;
}

export type IngestOutcome = "created" | "unchanged" | "replaced";

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  collection: string;
  outcome: IngestOutcome;
}

function isUnderRoot(absolutePath: string, root: string): boolean {
  const resolvedRoot = resolve(root);
  return (
    absolutePath === resolvedRoot ||
    absolutePath.startsWith(`${resolvedRoot}\\`) ||
    absolutePath.startsWith(`${resolvedRoot}/`)
  );
}

function resolveIngestPath(filePath: string, allowedRoots: string[]): string {
  const absolutePath = resolve(filePath);
  if (!allowedRoots.some((root) => isUnderRoot(absolutePath, root))) {
    throw new Error(
      `Path must be under current working directory: ${filePath}`,
    );
  }

  return absolutePath;
}

export class IngestionService {
  constructor(
    private readonly registry: DocumentRegistry,
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly settingsStore?: SettingsStore,
    private readonly defaultCollection: string = DEFAULT_COLLECTION,
    private readonly allowedPathRoots: string[] = [process.cwd()],
  ) {}

  static create(config: AppConfig, deps: {
    registry: DocumentRegistry;
    vectorStore: ChromaVectorStore;
    embeddingClient: EmbeddingClient;
    settingsStore?: SettingsStore;
  }): IngestionService {
    return new IngestionService(
      deps.registry,
      deps.vectorStore,
      deps.embeddingClient,
      deps.settingsStore,
      config.DEFAULT_COLLECTION,
      [config.DATA_DIR, process.cwd()],
    );
  }

  async ingest(
    filePath: string,
    options?: IngestOptions,
  ): Promise<IngestResult> {
    const absolutePath = resolveIngestPath(filePath, this.allowedPathRoots);
    const collection = options?.collection ?? this.defaultCollection;
    const userId = options?.userId;
    if (!userId) {
      throw new Error("userId is required for ingestion");
    }

    const { text, mimeType, filename: parsedFilename } =
      await parseDocument(absolutePath);
    const filename = options?.filename ?? parsedFilename;
    const contentHash = computeContentHash(text);

    const existing = this.registry.findByUserAndFilename(userId, filename);
    if (existing?.contentHash === contentHash) {
      return {
        documentId: existing.id,
        chunkCount: existing.chunkCount,
        collection: existing.collection,
        outcome: "unchanged",
      };
    }

    const documentId =
      existing?.id ?? deriveDocumentIdForUserFile(userId, filename);
    const outcome = existing ? "replaced" : "created";

    if (existing) {
      await this.vectorStore.deleteByDocumentId(
        documentId,
        existing.collection,
      );
    }

    const chunkConfig = this.settingsStore?.getChunkConfig();
    const chunks = await chunkText(text, chunkConfig);

    this.registry.registerDocument({
      id: documentId,
      filename,
      sourcePath: absolutePath,
      mimeType,
      collection,
      status: "pending",
      userId,
      contentHash,
    });
    this.registry.updateStatus(documentId, "processing");

    const embeddings = await this.embeddingClient.embedDocuments(chunks);
    const chromaIds = await this.vectorStore.upsertChunks({
      documentId,
      filename,
      userId,
      chunks,
      embeddings,
      collection,
    });

    this.registry.trackChunkIds(documentId, chromaIds);
    this.registry.updateStatus(documentId, "indexed", chunks.length);

    return {
      documentId,
      chunkCount: chunks.length,
      collection,
      outcome,
    };
  }
}
