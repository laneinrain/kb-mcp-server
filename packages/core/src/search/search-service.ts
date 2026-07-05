import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import type { EmbeddingClient } from "../embeddings/embedding-client.js";
import type { ChromaVectorStore } from "../vector-store/chroma-store.js";
import type { SearchOptions, SearchResult } from "./types.js";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 10;
const SNIPPET_MAX_LEN = 500;

function formatScore(distance: number): number {
  const score = Math.max(0, Math.min(1, 1 - distance));
  return Math.round(score * 10000) / 10000;
}

function truncateText(text: string): string {
  if (text.length <= SNIPPET_MAX_LEN) {
    return text;
  }
  return `${text.slice(0, SNIPPET_MAX_LEN)}…`;
}

export class SearchService {
  constructor(
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly defaultCollection: string = DEFAULT_COLLECTION,
  ) {}

  static create(
    config: AppConfig,
    deps: {
      vectorStore: ChromaVectorStore;
      embeddingClient: EmbeddingClient;
    },
  ): SearchService {
    return new SearchService(
      deps.vectorStore,
      deps.embeddingClient,
      config.DEFAULT_COLLECTION,
    );
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const collection = options?.collection ?? this.defaultCollection;
    const topK = Math.min(options?.topK ?? DEFAULT_TOP_K, MAX_TOP_K);

    const embedding = await this.embeddingClient.embedQuery(query);
    const hits = await this.vectorStore.query({
      embedding,
      topK,
      collection,
    });

    const allowed = options?.allowedDocumentIds;
    const filtered = allowed
      ? hits.filter((hit) => allowed.has(hit.documentId))
      : hits;

    return filtered.map((hit) => ({
      documentId: hit.documentId,
      filename: hit.filename,
      chunkIndex: hit.chunkIndex,
      text: truncateText(hit.text),
      score: formatScore(hit.distance),
    }));
  }
}
