import type { AppConfig } from "@kb/config";
import { loadConfig } from "@kb/config";
import {
  ADMIN_DEFAULT_PASSWORD,
  createAuthProvider,
  hashPassword,
  openAuthDatabase,
  UserStore,
  type AuthProvider,
} from "@kb/auth";
import {
  ChromaVectorStore,
  ContextService,
  EmbeddingClient,
  getDocumentRegistry,
  initSettingsStore,
  SearchService,
  type DocumentRegistry,
  type SettingsStore,
} from "@kb/core";
import { McpAuthResolver } from "./auth/mcp-auth-resolver.js";

export interface McpServices {
  config: AppConfig;
  searchService: SearchService;
  contextService: ContextService;
  registry: DocumentRegistry;
  authProvider: AuthProvider | null;
  systemUserId: string | null;
  authResolver: McpAuthResolver;
}

export async function createMcpServices(): Promise<McpServices> {
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

  const settingsStore: SettingsStore = initSettingsStore(
    config,
    systemUserId ? { systemUserId } : undefined,
  );
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
  const authResolver = new McpAuthResolver({
    config,
    authProvider,
    registry,
    systemUserId,
  });

  return {
    config,
    searchService,
    contextService,
    registry,
    authProvider,
    systemUserId,
    authResolver,
  };
}
