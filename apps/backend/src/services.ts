import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AppConfig } from "@kb/config";
import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  ContextService,
  EmbeddingClient,
  getDocumentRegistry,
  IngestionService,
  initSettingsStore,
  SearchService,
  type DocumentRegistry,
  type SettingsStore,
} from "@kb/core";

export interface AppServices {
  config: AppConfig;
  registry: DocumentRegistry;
  settingsStore: SettingsStore;
  vectorStore: ChromaVectorStore;
  embeddingClient: EmbeddingClient;
  ingestionService: IngestionService;
  searchService: SearchService;
  contextService: ContextService;
  uploadsDir: string;
}

export async function createAppServices(): Promise<AppServices> {
  const config = loadConfig();
  const settingsStore = initSettingsStore(config);
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);

  const ingestionService = IngestionService.create(config, {
    registry,
    vectorStore,
    embeddingClient,
    settingsStore,
  });

  const searchService = SearchService.create(config, {
    vectorStore,
    embeddingClient,
  });

  const contextService = ContextService.create(config, {
    registry,
    vectorStore,
    settingsStore,
  });

  const uploadsDir = join(resolve(config.DATA_DIR), "uploads");
  await mkdir(uploadsDir, { recursive: true });

  return {
    config,
    registry,
    settingsStore,
    vectorStore,
    embeddingClient,
    ingestionService,
    searchService,
    contextService,
    uploadsDir,
  };
}
