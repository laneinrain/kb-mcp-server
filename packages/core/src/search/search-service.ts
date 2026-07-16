import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import type { EmbeddingClient } from "../embeddings/embedding-client.js";
import { RerankClient } from "../rerank/rerank-client.js";
import type { ChromaVectorStore, QueryHit } from "../vector-store/chroma-store.js";
import type { SearchOptions, SearchResult } from "./types.js";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 10;
const SNIPPET_MAX_LEN = 500;

interface SearchRerankOptions {
  client: RerankClient;
  enabled: boolean;
  candidates: number;
}

function formatScore(distance: number): number {
  const score = Math.max(0, Math.min(1, 1 - distance));
  return Math.round(score * 10000) / 10000;
}

function formatRerankScore(score: number): number {
  return Math.round(score * 10000) / 10000;
}

function truncateText(text: string): string {
  if (text.length <= SNIPPET_MAX_LEN) {
    return text;
  }
  return `${text.slice(0, SNIPPET_MAX_LEN)}…`;
}

function mapVectorHits(hits: QueryHit[], topK: number): SearchResult[] {
  return hits.slice(0, topK).map((hit) => ({
    documentId: hit.documentId,
    filename: hit.filename,
    chunkIndex: hit.chunkIndex,
    text: truncateText(hit.text),
    score: formatScore(hit.distance),
  }));
}

export class SearchService {
  constructor(
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly defaultCollection: string = DEFAULT_COLLECTION,
    private readonly rerank?: SearchRerankOptions,
  ) {}

  static create(
    config: AppConfig,
    deps: {
      vectorStore: ChromaVectorStore;
      embeddingClient: EmbeddingClient;
      rerankClient?: RerankClient;
    },
  ): SearchService {
    const rerank =
      config.RERANK_ENABLED
        ? {
            client: deps.rerankClient ?? new RerankClient(config),
            enabled: true,
            candidates: config.RERANK_CANDIDATES,
          }
        : undefined;

    return new SearchService(
      deps.vectorStore,
      deps.embeddingClient,
      config.DEFAULT_COLLECTION,
      rerank,
    );
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const collection = options?.collection ?? this.defaultCollection;
    const topK = Math.min(options?.topK ?? DEFAULT_TOP_K, MAX_TOP_K);
    const recallK =
      this.rerank?.enabled === true
        ? Math.max(topK, this.rerank.candidates)
        : topK;

    const embedding = await this.embeddingClient.embedQuery(query);
    const hits = await this.vectorStore.query({
      embedding,
      topK: recallK,
      collection,
    });

    const allowed = options?.allowedDocumentIds;
    const filtered = allowed
      ? hits.filter((hit) => allowed.has(hit.documentId))
      : hits;

    if (!this.rerank?.enabled || filtered.length === 0) {
      return mapVectorHits(filtered, topK);
    }

    try {
      const ranked = await this.rerank.client.rerank(
        query,
        filtered.map((hit) => hit.text),
        { topN: topK },
      );

      return ranked.map((item) => {
        const hit = filtered[item.index];
        if (!hit) {
          throw new Error(`Rerank returned invalid index ${item.index}`);
        }

        return {
          documentId: hit.documentId,
          filename: hit.filename,
          chunkIndex: hit.chunkIndex,
          text: truncateText(hit.text),
          score: formatRerankScore(item.relevanceScore),
        };
      });
    } catch {
      return mapVectorHits(filtered, topK);
    }
  }
}
