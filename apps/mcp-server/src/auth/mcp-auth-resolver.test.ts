import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "@kb/config";
import type { DocumentRegistry } from "@kb/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockCasAuthProvider } from "@kb/auth";
import { McpAuthError, McpAuthResolver } from "./mcp-auth-resolver.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
const API_KEY = "mcp-service-key";
const SYSTEM_USER_ID = "system-user-uuid";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    USER_AUTH_ENABLED: true,
    AUTH_ENABLED: true,
    API_KEY,
    ...overrides,
  } as AppConfig;
}

describe("McpAuthResolver", () => {
  let tempDir: string;
  let provider: MockCasAuthProvider | null = null;

  afterEach(() => {
    provider?.close();
    provider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  function createProvider(): MockCasAuthProvider {
    tempDir = mkdtempSync(join(tmpdir(), "kb-mcp-auth-"));
    provider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });
    return provider;
  }

  function mockRegistry(docIds: string[]): DocumentRegistry {
    return {
      listDocumentsForUser: vi.fn(() =>
        docIds.map((id) => ({ id, filename: `${id}.txt` })),
      ),
    } as unknown as DocumentRegistry;
  }

  it("returns global when USER_AUTH_ENABLED is false", async () => {
    const resolver = new McpAuthResolver({
      config: makeConfig({ USER_AUTH_ENABLED: false }),
      authProvider: null,
      registry: mockRegistry([]),
      systemUserId: null,
    });

    const ctx = await resolver.resolve(undefined);
    expect(ctx).toEqual({ authMode: "global" });
  });

  it("throws when token missing and user auth enabled", async () => {
    const resolver = new McpAuthResolver({
      config: makeConfig(),
      authProvider: createProvider(),
      registry: mockRegistry([]),
      systemUserId: SYSTEM_USER_ID,
    });

    await expect(resolver.resolve(undefined)).rejects.toBeInstanceOf(
      McpAuthError,
    );
    await expect(resolver.resolve(undefined)).rejects.toMatchObject({
      message: "Missing Bearer token",
      statusCode: 401,
    });
  });

  it("returns user context with allowedDocumentIds", async () => {
    const authProvider = createProvider();
    const login = await authProvider.login({
      employeeId: "11223344",
      password: "pw",
    });
    const registry = mockRegistry(["doc-a", "doc-b"]);

    const resolver = new McpAuthResolver({
      config: makeConfig(),
      authProvider,
      registry,
      systemUserId: SYSTEM_USER_ID,
    });

    const ctx = await resolver.resolve(login.tokens.accessToken);

    expect(ctx.authMode).toBe("user");
    expect(ctx.authUser?.employeeId).toBe("11223344");
    expect(ctx.allowedDocumentIds).toEqual(new Set(["doc-a", "doc-b"]));
    expect(registry.listDocumentsForUser).toHaveBeenCalledWith(
      login.user.id,
      SYSTEM_USER_ID,
    );
  });

  it("returns service context without ACL filter", async () => {
    const resolver = new McpAuthResolver({
      config: makeConfig(),
      authProvider: createProvider(),
      registry: mockRegistry(["doc-a"]),
      systemUserId: SYSTEM_USER_ID,
    });

    const ctx = await resolver.resolve(API_KEY);
    expect(ctx).toEqual({ authMode: "service" });
    expect(ctx.allowedDocumentIds).toBeUndefined();
  });
});
