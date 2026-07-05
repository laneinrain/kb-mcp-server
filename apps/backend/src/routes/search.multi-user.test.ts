import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockCasAuthProvider } from "@kb/auth";
import type { DocumentRecord } from "@kb/core";
import type { AppConfig } from "@kb/config";
import {
  createProtectedRouteOpts,
  registerBearerAuthIfEnabled,
} from "../auth.js";
import { registerSearchRoutes } from "./search.js";
import "../types.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";

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
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  };
}

describe("search multi-user isolation", () => {
  let tempDir: string;
  let authProvider: MockCasAuthProvider | null = null;

  afterEach(() => {
    authProvider?.close();
    authProvider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore Windows cleanup races
      }
    }
  });

  async function buildApp() {
    tempDir = mkdtempSync(join(tmpdir(), "kb-search-multi-user-"));
    authProvider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    const userA = await authProvider.login({
      employeeId: "11111111",
      password: "a",
    });
    const systemUserId = "system-user-id";
    const docs = [
      createDoc("doc-a", userA.user.id),
      createDoc("doc-b", "other-user-id"),
    ];

    const registry = {
      listDocumentsForUser: vi.fn((userId: string, systemId: string) =>
        docs.filter(
          (doc) => doc.userId === userId || doc.userId === systemId,
        ),
      ),
    };

    const searchService = {
      search: vi.fn().mockResolvedValue([
        {
          score: 0.9,
          text: "hit a",
          documentId: "doc-a",
          filename: "doc-a.txt",
          chunkIndex: 0,
        },
        {
          score: 0.8,
          text: "hit b",
          documentId: "doc-b",
          filename: "doc-b.txt",
          chunkIndex: 0,
        },
      ]),
    };

    const config = {
      AUTH_ENABLED: true,
      API_KEY: "service-key",
      USER_AUTH_ENABLED: true,
    } as AppConfig;

    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await registerBearerAuthIfEnabled(app, config);
    const routeOpts = createProtectedRouteOpts(config, app, authProvider);
    await registerSearchRoutes(app, {
      searchService: searchService as never,
      registry: registry as never,
      systemUserId,
      routeOpts,
    });

    return {
      app,
      searchService,
      tokenA: userA.tokens.accessToken,
    };
  }

  it("JWT search passes allowedDocumentIds for visible docs only", async () => {
    const { app, searchService, tokenA } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/search",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { query: "hello" },
    });

    expect(response.statusCode).toBe(200);
    expect(searchService.search).toHaveBeenCalledWith(
      "hello",
      expect.objectContaining({
        allowedDocumentIds: expect.any(Set),
      }),
    );
    const allowed = searchService.search.mock.calls[0][1]
      .allowedDocumentIds as Set<string>;
    expect(allowed.has("doc-a")).toBe(true);
    expect(allowed.has("doc-b")).toBe(false);
  });
});
