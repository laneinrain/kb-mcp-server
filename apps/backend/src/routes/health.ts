import type { FastifyInstance } from "fastify";
import { EMBEDDING_MODEL } from "@kb/config";
import type { ChromaVectorStore } from "@kb/core";
import type { EmbeddingClient } from "@kb/core";

export interface HealthDeps {
  vectorStore: ChromaVectorStore;
  embeddingClient: EmbeddingClient;
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  deps: HealthDeps,
): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/health/chroma", async (_request, reply) => {
    try {
      await deps.vectorStore.heartbeat();
      return { status: "ok" };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  app.get("/health/embeddings", async (_request, reply) => {
    try {
      await deps.embeddingClient.ping();
      return { status: "ok", model: EMBEDDING_MODEL };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        model: EMBEDDING_MODEL,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
