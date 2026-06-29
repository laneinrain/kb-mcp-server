import Fastify from "fastify";
import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  initSettingsStore,
} from "@kb/core";
import { registerHealthRoutes } from "./routes/health.js";

async function main(): Promise<void> {
  const config = loadConfig();
  initSettingsStore(config);

  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);

  const app = Fastify({ logger: true });
  await registerHealthRoutes(app, { vectorStore, embeddingClient });

  const host = config.BACKEND_HOST;
  const port = config.BACKEND_PORT;

  await app.listen({ host, port });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
