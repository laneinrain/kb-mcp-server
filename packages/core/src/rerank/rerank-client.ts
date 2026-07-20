import { RERANK_MODEL, type AppConfig } from "@kb/config";
import { RerankError } from "./errors.js";
import type { RerankOptions, RerankResult } from "./types.js";

const MAX_RETRIES = 3;

type FetchFn = typeof fetch;

interface RerankApiResult {
  index: number;
  relevance_score: number;
}

interface RerankApiResponse {
  results?: RerankApiResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRelevanceScore(value: unknown): number {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function parseResults(payload: RerankApiResponse): RerankResult[] {
  if (!Array.isArray(payload.results)) {
    throw new RerankError(
      "Rerank API returned an unexpected response (missing results array). Check rerank Base URL.",
    );
  }

  return payload.results
    .map((item) => ({
      index: Number(item.index),
      relevanceScore: parseRelevanceScore(item.relevance_score),
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export type RerankBaseUrlResolver = () => string;

export class RerankClient {
  private readonly fetchFn: FetchFn;
  private readonly getBaseUrl: RerankBaseUrlResolver;
  private readonly apiKey: string;

  constructor(
    private readonly config: AppConfig,
    fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
    getBaseUrl?: RerankBaseUrlResolver,
  ) {
    this.fetchFn = fetchFn;
    this.apiKey = config.CHERRYIN_API_KEY;
    this.getBaseUrl =
      getBaseUrl ?? (() => config.CHERRYIN_BASE_URL.replace(/\/+$/, ""));
  }

  async rerank(
    query: string,
    documents: string[],
    options?: RerankOptions,
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    const base = this.getBaseUrl().replace(/\/+$/, "");
    const url = `${base}/rerank`;
    const body: Record<string, unknown> = {
      model: options?.model ?? RERANK_MODEL,
      query,
      documents,
    };

    if (options?.topN !== undefined) {
      body.top_n = options.topN;
    }

    const payload = await this.postWithRetry(url, body);
    return parseResults(payload);
  }

  async ping(): Promise<void> {
    await this.rerank("health-check", ["health-check"], { topN: 1 });
  }

  private async postWithRetry(
    url: string,
    body: Record<string, unknown>,
  ): Promise<RerankApiResponse> {
    let attempt = 0;

    while (true) {
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(2 ** attempt * 250);
        continue;
      }

      if (!response.ok) {
        const snippet = (await response.text()).slice(0, 200);
        throw new RerankError(
          `Rerank API request failed (${response.status}): ${snippet}`,
          response.status,
        );
      }

      return (await response.json()) as RerankApiResponse;
    }
  }
}
