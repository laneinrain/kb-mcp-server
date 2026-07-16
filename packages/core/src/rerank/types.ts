export interface RerankResult {
  index: number;
  relevanceScore: number;
}

export interface RerankOptions {
  topN?: number;
  model?: string;
}
