import { ChromaClient, type Collection } from "chromadb";
import {
  DEFAULT_COLLECTION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  type AppConfig,
} from "@kb/config";

export function buildChunkId(documentId: string, chunkIndex: number): string {
  return `${documentId}:${chunkIndex}`;
}

export interface UpsertChunksParams {
  documentId: string;
  filename: string;
  chunks: string[];
  embeddings: number[][];
  collection?: string;
}

export interface QueryParams {
  embedding: number[];
  topK: number;
  collection?: string;
}

export interface QueryHit {
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
  distance: number;
}

interface ChromaClientLike {
  heartbeat(): Promise<number>;
  getOrCreateCollection(args: {
    name: string;
    metadata?: Record<string, string | number>;
    /** Explicit null disables Chroma's default embed function (we supply vectors). */
    embeddingFunction: null;
  }): Promise<Collection>;
}

export class ChromaVectorStore {
  private client: ChromaClientLike;
  private collections = new Map<string, Collection>();

  constructor(config: AppConfig, client?: ChromaClientLike) {
    this.client =
      client ??
      new ChromaClient({
        host: config.CHROMA_HOST,
        port: config.CHROMA_PORT,
      });
  }

  async connect(): Promise<void> {
    await this.client.heartbeat();
  }

  async heartbeat(): Promise<void> {
    await this.client.heartbeat();
  }

  async getOrCreateCollection(name?: string): Promise<Collection> {
    const collectionName = name ?? DEFAULT_COLLECTION;
    const cached = this.collections.get(collectionName);
    if (cached) {
      return cached;
    }

    const collection = await this.client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: null,
      metadata: {
        embedding_model: EMBEDDING_MODEL,
        embedding_dim: EMBEDDING_DIMENSIONS,
        "hnsw:space": "cosine",
      },
    });
    this.collections.set(collectionName, collection);
    return collection;
  }

  async upsertChunks(params: UpsertChunksParams): Promise<string[]> {
    const { documentId, filename, chunks, embeddings, collection } = params;

    if (embeddings.length !== chunks.length) {
      throw new Error("embeddings length must match chunks length");
    }

    const col = await this.getOrCreateCollection(collection);
    const ids = chunks.map((_, index) => buildChunkId(documentId, index));
    const metadatas = chunks.map((_, index) => ({
      document_id: documentId,
      filename,
      chunk_index: index,
    }));

    await col.upsert({
      ids,
      embeddings,
      documents: chunks,
      metadatas,
    });

    return ids;
  }

  async deleteByDocumentId(
    documentId: string,
    collection?: string,
  ): Promise<void> {
    const col = await this.getOrCreateCollection(collection);
    await col.delete({ where: { document_id: documentId } });
  }

  async query(params: QueryParams): Promise<QueryHit[]> {
    const { embedding, topK, collection } = params;
    const col = await this.getOrCreateCollection(collection);

    const result = await col.query({
      queryEmbeddings: [embedding],
      nResults: topK,
      include: ["documents", "metadatas", "distances"],
    });

    const ids = result.ids[0] ?? [];
    const documents = result.documents[0] ?? [];
    const metadatas = result.metadatas[0] ?? [];
    const distances = result.distances[0] ?? [];

    return ids.map((_, index) => ({
      documentId: String(metadatas[index]?.document_id ?? ""),
      filename: String(metadatas[index]?.filename ?? ""),
      chunkIndex: Number(metadatas[index]?.chunk_index ?? 0),
      text: documents[index] ?? "",
      distance: distances[index] ?? 0,
    }));
  }
}
