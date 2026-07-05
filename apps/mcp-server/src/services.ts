import type { AppConfig } from "@kb/config";
import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  ContextService,
  EmbeddingClient,
  getDocumentRegistry,
  initSettingsStore,
  SearchService,
  type SettingsStore,
} from "@kb/core";

export interface McpServices {
  config: AppConfig;
  searchService: SearchService;
  contextService: ContextService;
}

export async function createMcpServices(): Promise<McpServices> {
  const config = loadConfig();
  const settingsStore: SettingsStore = initSettingsStore(config);
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);
  const searchService = SearchService.create(config, {
    vectorStore,
    embeddingClient,
  });
  const contextService = ContextService.create(config, {
    registry,
    vectorStore,
    settingsStore,
  });
  return { config, searchService, contextService };
}
