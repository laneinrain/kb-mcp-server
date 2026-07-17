export interface ContextChunk {
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
  isCenter?: boolean;
}

export interface ReadAroundOptions {
  window?: number;
  collection?: string;
  /** When set, documentId must be in the set or read fails with document_not_found */
  allowedDocumentIds?: ReadonlySet<string>;
}

export interface ReadFileOptions {
  collection?: string;
  /** When set, documentId must be in the set or read fails with document_not_found */
  allowedDocumentIds?: ReadonlySet<string>;
}

export interface ReadAroundResult {
  documentId: string;
  filename: string;
  collection: string;
  chunkRange: { start: number; end: number };
  windowRequested: number;
  windowApplied: number;
  truncated?: boolean;
  totalChars?: number;
  chunks: ContextChunk[];
}

export interface ReadFileResult {
  documentId: string;
  filename: string;
  collection: string;
  chunkCount: number;
  returnedChunks: number;
  truncated?: boolean;
  chunks: ContextChunk[];
}
