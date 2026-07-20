import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AppConfig } from "@kb/config";
import { loadConfig } from "@kb/config";
import {
  createAuthProvider,
  openAuthDatabase,
  UserStore,
  hashPassword,
  ADMIN_DEFAULT_PASSWORD,
  type AuthProvider,
} from "@kb/auth";
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
  authProvider: AuthProvider | null;
  systemUserId: string | null;
}

export async function createAppServices(): Promise<AppServices> {
  const config = loadConfig();

  let systemUserId: string | null = null;
  let authProvider: AuthProvider | null = null;

  if (config.USER_AUTH_ENABLED) {
    const authDb = openAuthDatabase(config.AUTH_SQLITE_PATH);
    try {
      const userStore = new UserStore(authDb);
      systemUserId = userStore.ensureSystemUser().id;
      if (config.CAS_MOCK) {
        const adminHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);
        userStore.ensureAdminUser(adminHash);
      }
    } finally {
      authDb.close();
    }

    authProvider = createAuthProvider({
      dbPath: config.AUTH_SQLITE_PATH,
      jwtSecret: config.JWT_SECRET!,
      jwtExpiresInSeconds: config.JWT_EXPIRES_IN,
      authProvider: config.AUTH_PROVIDER,
      casMock: config.CAS_MOCK,
      casServerUrl: config.CAS_SERVER_URL,
    });
  }

  const settingsStore = initSettingsStore(
    config,
    systemUserId ? { systemUserId } : undefined,
  );
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config, undefined, () => {
    const models = settingsStore.getModelConfig();
    return {
      model: models.embeddingModel,
      baseURL: models.embeddingBaseUrl,
    };
  });

  const ingestionService = IngestionService.create(config, {
    registry,
    vectorStore,
    embeddingClient,
    settingsStore,
  });

  const searchService = SearchService.create(config, {
    vectorStore,
    embeddingClient,
    settingsStore,
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
    authProvider,
    systemUserId,
  };
}
