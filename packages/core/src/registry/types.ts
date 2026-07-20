export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export interface ContextConfig {
  readAroundWindowDefault: number;
  readAroundWindowMax: number;
  readAroundMaxChars: number;
  readFileMaxChunks: number;
  readFileMaxChars: number;
}

export interface ModelConfig {
  /** OpenAI-compatible embeddings base URL (typically ends with /v1). */
  embeddingBaseUrl: string;
  embeddingModel: string;
  rerankEnabled: boolean;
  /** Provider base URL for POST {base}/rerank (OpenAI-compatible style). */
  rerankBaseUrl: string;
  rerankModel: string;
  rerankCandidates: number;
}

export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";

export interface DocumentRecord {
  id: string;
  filename: string;
  sourcePath: string;
  mimeType: string;
  status: DocumentStatus;
  chunkCount: number;
  collection: string;
  userId: string;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDocumentInput {
  id: string;
  filename: string;
  sourcePath: string;
  mimeType: string;
  collection: string;
  status?: DocumentStatus;
  userId: string;
  contentHash?: string | null;
}
