import type { FastifyInstance } from "fastify";
import type { ChromaVectorStore } from "@kb/core";
import type { EmbeddingClient } from "@kb/core";

export interface HealthDeps {
  vectorStore: ChromaVectorStore;
  embeddingClient: EmbeddingClient;
  getEmbeddingModel: () => string;
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
    const model = deps.getEmbeddingModel();
    try {
      await deps.embeddingClient.ping();
      return { status: "ok", model };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        model,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
