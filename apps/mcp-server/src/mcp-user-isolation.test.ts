import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { MockCasAuthProvider } from "@kb/auth";
import type { AppConfig } from "@kb/config";
import {
  ContextService,
  type DocumentRecord,
  type SearchService,
} from "@kb/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpAuthResolver } from "./auth/mcp-auth-resolver.js";
import { runWithMcpCallerContext } from "./auth/mcp-request-context.js";
import {
  buildMcpServer,
  READ_AROUND_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  SEARCH_TOOL_NAME,
} from "./server.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
const SYSTEM_USER_ID = "system-user-id";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    USER_AUTH_ENABLED: true,
    MCP_AUTH_REQUIRED: true,
    AUTH_ENABLED: false,
    DEFAULT_COLLECTION: "default",
    ...overrides,
  } as AppConfig;
}

function createDoc(id: string, userId: string): DocumentRecord {
  return {
    id,
    filename: `${id}.txt`,
    sourcePath: `/${id}.txt`,
    mimeType: "text/plain",
    status: "indexed",
    chunkCount: 1,
    collection: "default",
    userId,
    contentHash: null,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
}

describe("MCP user isolation (PLAT-16)", () => {
  let tempDir: string;
  let authProvider: MockCasAuthProvider | null = null;

  afterEach(() => {
    authProvider?.close();
    authProvider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  async function setupUsers() {
    tempDir = mkdtempSync(join(tmpdir(), "kb-mcp-isolation-"));
    authProvider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    const userA = await authProvider.login({
      employeeId: "11111111",
      password: "a",
    });
    const userB = await authProvider.login({
      employeeId: "22222222",
      password: "b",
    });

    const docs = [
      createDoc("doc-a", userA.user.id),
      createDoc("doc-b", userB.user.id),
    ];

    const registry = {
      listDocumentsForUser: vi.fn((userId: string, systemId: string) =>
        docs.filter(
          (doc) => doc.userId === userId || doc.userId === systemId,
        ),
      ),
      getDocument: vi.fn((id: string) => docs.find((doc) => doc.id === id)),
      getChunkIds: vi.fn((id: string) => [`${id}:0`]),
    };

    const vectorStore = {
      getByIds: vi.fn(async ({ ids }: { ids: string[] }) =>
        ids.map((chunkId) => {
          const [documentId = "", index = "0"] = chunkId.split(":");
          const doc = docs.find((d) => d.id === documentId);
          return {
            documentId,
            filename: doc?.filename ?? `${documentId}.txt`,
            chunkIndex: Number(index),
            text: `content of ${documentId}`,
          };
        }),
      ),
    };

    const settingsStore = {
      getContextConfig: vi.fn(() => ({
        readAroundWindowDefault: 1,
        readAroundWindowMax: 3,
        readAroundMaxChars: 32000,
        readFileMaxChunks: 50,
        readFileMaxChars: 64000,
      })),
    };

    const contextService = new ContextService(
      registry as never,
      vectorStore as never,
      settingsStore as never,
      "default",
    );

    const search = vi.fn(async () => []);
    const searchService = { search } as unknown as SearchService;

    const resolver = new McpAuthResolver({
      config: makeConfig(),
      authProvider,
      registry: registry as never,
      systemUserId: SYSTEM_USER_ID,
    });

    return {
      userA,
      userB,
      registry,
      search,
      searchService,
      contextService,
      resolver,
    };
  }

  async function connectClient(
    searchService: SearchService,
    contextService: ContextService,
  ) {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = buildMcpServer(searchService, contextService);
    await server.connect(serverTransport);
    const client = new Client({ name: "iso-test", version: "1.0.0" });
    await client.connect(clientTransport);
    return { client, server };
  }

  it("user A search receives only A's allowedDocumentIds", async () => {
    const { userA, search, searchService, contextService, resolver } =
      await setupUsers();
    const { client, server } = await connectClient(
      searchService,
      contextService,
    );
    const ctx = await resolver.resolve(userA.tokens.accessToken);

    await runWithMcpCallerContext(ctx, async () => {
      await client.callTool({
        name: SEARCH_TOOL_NAME,
        arguments: { query: "hello" },
      });
    });

    expect(search).toHaveBeenCalledWith(
      "hello",
      expect.objectContaining({
        allowedDocumentIds: new Set(["doc-a"]),
      }),
    );

    await client.close();
    await server.close();
  });

  it("user A cannot read_file user B document", async () => {
    const { userA, searchService, contextService, resolver } =
      await setupUsers();
    const { client, server } = await connectClient(
      searchService,
      contextService,
    );
    const ctx = await resolver.resolve(userA.tokens.accessToken);

    const response = await runWithMcpCallerContext(ctx, async () =>
      client.callTool({
        name: READ_FILE_TOOL_NAME,
        arguments: { document_id: "doc-b" },
      }),
    );

    expect(response.isError).toBe(true);
    const content = response.content as { type: string; text: string }[];
    expect(content[0]?.text).toMatch(/not found/i);

    await client.close();
    await server.close();
  });

  it("user A can read_file and read_around own document", async () => {
    const { userA, searchService, contextService, resolver } =
      await setupUsers();
    const { client, server } = await connectClient(
      searchService,
      contextService,
    );
    const ctx = await resolver.resolve(userA.tokens.accessToken);

    const fileResponse = await runWithMcpCallerContext(ctx, async () =>
      client.callTool({
        name: READ_FILE_TOOL_NAME,
        arguments: { document_id: "doc-a" },
      }),
    );
    expect(fileResponse.isError).toBeFalsy();
    expect(fileResponse.structuredContent).toMatchObject({
      documentId: "doc-a",
    });

    const aroundResponse = await runWithMcpCallerContext(ctx, async () =>
      client.callTool({
        name: READ_AROUND_TOOL_NAME,
        arguments: { document_id: "doc-a", chunk_index: 0 },
      }),
    );
    expect(aroundResponse.isError).toBeFalsy();
    expect(aroundResponse.structuredContent).toMatchObject({
      documentId: "doc-a",
    });

    await client.close();
    await server.close();
  });

  it("user B search ACL is B's document set", async () => {
    const { userB, search, searchService, contextService, resolver } =
      await setupUsers();
    const { client, server } = await connectClient(
      searchService,
      contextService,
    );
    const ctx = await resolver.resolve(userB.tokens.accessToken);

    await runWithMcpCallerContext(ctx, async () => {
      await client.callTool({
        name: SEARCH_TOOL_NAME,
        arguments: { query: "from-b" },
      });
    });

    expect(search).toHaveBeenCalledWith(
      "from-b",
      expect.objectContaining({
        allowedDocumentIds: new Set(["doc-b"]),
      }),
    );

    await client.close();
    await server.close();
  });

  it("MCP_AUTH_REQUIRED=false resolves unauthenticated global context", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-mcp-escape-"));
    authProvider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    const resolver = new McpAuthResolver({
      config: makeConfig({
        USER_AUTH_ENABLED: true,
        MCP_AUTH_REQUIRED: false,
      }),
      authProvider,
      registry: {
        listDocumentsForUser: vi.fn(() => []),
      } as never,
      systemUserId: SYSTEM_USER_ID,
    });

    const ctx = await resolver.resolve(undefined);
    expect(ctx).toEqual({ authMode: "global" });
  });
});
