import type { AppConfig } from "@kb/config";
import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  SearchService,
} from "@kb/core";

export interface McpServices {
  config: AppConfig;
  searchService: SearchService;
}

export async function createMcpServices(): Promise<McpServices> {
  const config = loadConfig();
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);
  const searchService = SearchService.create(config, {
    vectorStore,
    embeddingClient,
  });
  return { config, searchService };
}
