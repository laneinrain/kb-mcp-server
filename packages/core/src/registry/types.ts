export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
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
}
