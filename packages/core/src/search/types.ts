export interface SearchOptions {
  collection?: string;
  topK?: number;
}

export interface SearchResult {
  score: number;
  text: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
}
