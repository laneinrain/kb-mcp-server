export interface SearchOptions {
  collection?: string;
  topK?: number;
  allowedDocumentIds?: ReadonlySet<string>;
}

export interface SearchResult {
  score: number;
  text: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
}
