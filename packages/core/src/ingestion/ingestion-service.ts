import { createHash } from "node:crypto";
import { normalize, resolve } from "node:path";
import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import { EmbeddingClient } from "../embeddings/embedding-client.js";
import type { DocumentRegistry } from "../registry/document-registry.js";
import type { SettingsStore } from "../registry/settings-store.js";
import { ChromaVectorStore } from "../vector-store/chroma-store.js";
import { chunkText } from "./chunker.js";
import { parseDocument } from "./parsers/index.js";

export interface IngestOptions {
  collection?: string;
  /** Original upload filename when temp path includes a storage prefix */
  filename?: string;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  collection: string;
}

function deriveDocumentId(absolutePath: string): string {
  const normalized = normalize(resolve(absolutePath));
  return createHash("sha256").update(normalized).digest("hex");
}

function resolveIngestPath(filePath: string): string {
  const absolutePath = resolve(filePath);
  const cwd = resolve(process.cwd());

  if (
    absolutePath !== cwd &&
    !absolutePath.startsWith(`${cwd}\\`) &&
    !absolutePath.startsWith(`${cwd}/`)
  ) {
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
    );
  }

  async ingest(
    filePath: string,
    options?: IngestOptions,
  ): Promise<IngestResult> {
    const absolutePath = resolveIngestPath(filePath);
    const documentId = deriveDocumentId(absolutePath);
    const collection = options?.collection ?? this.defaultCollection;

    const { text, mimeType, filename: parsedFilename } =
      await parseDocument(absolutePath);
    const filename = options?.filename ?? parsedFilename;
    const chunkConfig = this.settingsStore?.getChunkConfig();
    const chunks = await chunkText(text, chunkConfig);

    const existing = this.registry.getDocument(documentId);
    if (existing) {
      await this.vectorStore.deleteByDocumentId(documentId, collection);
    }

    this.registry.registerDocument({
      id: documentId,
      filename,
      sourcePath: absolutePath,
      mimeType,
      collection,
      status: "pending",
    });
    this.registry.updateStatus(documentId, "processing");

    const embeddings = await this.embeddingClient.embedDocuments(chunks);
    const chromaIds = await this.vectorStore.upsertChunks({
      documentId,
      filename,
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
    };
  }
}
