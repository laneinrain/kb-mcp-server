import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AppConfig } from "@kb/config";
import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  getDocumentRegistry,
  IngestionService,
  initSettingsStore,
  SearchService,
  type DocumentRegistry,
} from "@kb/core";

export interface AppServices {
  config: AppConfig;
  registry: DocumentRegistry;
  vectorStore: ChromaVectorStore;
  embeddingClient: EmbeddingClient;
  ingestionService: IngestionService;
  searchService: SearchService;
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

  const uploadsDir = join(resolve(config.DATA_DIR), "uploads");
  await mkdir(uploadsDir, { recursive: true });

  return {
    config,
    registry,
    vectorStore,
    embeddingClient,
    ingestionService,
    searchService,
    uploadsDir,
  };
}
