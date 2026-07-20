import OpenAI from "openai";
import { EMBEDDING_DIMENSIONS, type AppConfig } from "@kb/config";

const QUERY_INSTRUCTION =
  "Given a user question, retrieve relevant passages from the knowledge base";
const QUERY_PREFIX = `Instruct: ${QUERY_INSTRUCTION}\nQuery:`;
const BATCH_SIZE = 64;
const MAX_RETRIES = 3;

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 429
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type EmbeddingEndpointResolver = () => {
  model: string;
  baseURL: string;
};

export class EmbeddingClient {
  private client: OpenAI | null;
  private cachedBaseURL: string | null = null;
  private readonly apiKey: string;
  private readonly resolveEndpoint: EmbeddingEndpointResolver;
  private readonly injectedClient: OpenAI | null;

  constructor(
    config: AppConfig,
    client?: OpenAI,
    resolveEndpoint?: EmbeddingEndpointResolver | (() => string),
  ) {
    this.apiKey = config.CHERRYIN_API_KEY;
    this.injectedClient = client ?? null;
    this.client = client ?? null;

    if (resolveEndpoint) {
      // Back-compat: old callers passed () => model string only
      this.resolveEndpoint = () => {
        const value = resolveEndpoint();
        if (typeof value === "string") {
          return {
            model: value,
            baseURL: config.CHERRYIN_BASE_URL.replace(/\/+$/, ""),
          };
        }
        return {
          model: value.model,
          baseURL: value.baseURL.replace(/\/+$/, ""),
        };
      };
    } else {
      this.resolveEndpoint = () => ({
        model: config.EMBEDDING_MODEL,
        baseURL: config.CHERRYIN_BASE_URL.replace(/\/+$/, ""),
      });
    }
  }

  getEmbeddingModel(): string {
    return this.resolveEndpoint().model;
  }

  formatQuery(text: string): string {
    return `${QUERY_PREFIX}${text}`;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
      const batch = texts.slice(offset, offset + BATCH_SIZE);
      const embeddings = await this.embedBatchWithRetry(batch);
      results.push(...embeddings);
    }
    return results;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedDocuments([this.formatQuery(text)]);
    return embedding;
  }

  async ping(): Promise<void> {
    await this.embedDocuments(["health-check"]);
  }

  private getClient(baseURL: string): OpenAI {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    if (!this.client || this.cachedBaseURL !== baseURL) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL,
      });
      this.cachedBaseURL = baseURL;
    }
    return this.client;
  }

  private async embedBatchWithRetry(batch: string[]): Promise<number[][]> {
    let attempt = 0;
    const { model, baseURL } = this.resolveEndpoint();
    const client = this.getClient(baseURL);

    while (true) {
      try {
        const response = await client.embeddings.create({
          model,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        if (!response.data) {
          throw new Error(
            "Embedding API returned an unexpected response (missing data). Check embedding Base URL (should end with /v1).",
          );
        }

        return response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= MAX_RETRIES) {
          throw error;
        }

        attempt += 1;
        await sleep(2 ** attempt * 250);
      }
    }
  }
}
