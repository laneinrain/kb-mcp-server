import OpenAI from "openai";
import { EMBEDDING_DIMENSIONS, type AppConfig } from "@kb/config";

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";

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

export class EmbeddingClient {
  private client: OpenAI;

  constructor(config: AppConfig, client?: OpenAI) {
    this.client =
      client ??
      new OpenAI({
        apiKey: config.CHERRYIN_API_KEY,
        baseURL: config.CHERRYIN_BASE_URL,
      });
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

  private async embedBatchWithRetry(batch: string[]): Promise<number[][]> {
    let attempt = 0;

    while (true) {
      try {
        const response = await this.client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        });

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
