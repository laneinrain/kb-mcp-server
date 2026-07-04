export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";

export interface DocumentRecord {
  id: string;
  filename: string;
  mimeType: string;
  status: DocumentStatus;
  chunkCount: number;
  collection: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResultItem {
  score: number;
  text: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = "ApiError";
  }
}
