import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockCasAuthProvider } from "@kb/auth";
import type { DocumentRecord } from "@kb/core";
import type { AppConfig } from "@kb/config";
import {
  createProtectedRouteOpts,
  registerBearerAuthIfEnabled,
} from "../auth.js";
import { registerDocumentRoutes } from "./documents.js";
import "../types.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";

function createDoc(
  id: string,
  userId: string,
  filename: string,
): DocumentRecord {
  return {
    id,
    filename,
    sourcePath: `/${filename}`,
    mimeType: "text/plain",
    status: "indexed",
    chunkCount: 1,
    collection: "default",
    userId,
    contentHash: null,
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  };
}

describe("documents multi-user isolation", () => {
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
    tempDir = mkdtempSync(join(tmpdir(), "kb-docs-multi-user-"));
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
    const systemUserId = "system-user-id";

    const docs = [
      createDoc("doc-a", userA.user.id, "a.txt"),
      createDoc("doc-b", userB.user.id, "b.txt"),
      createDoc("doc-system", systemUserId, "legacy.txt"),
    ];

    const registry = {
      listDocuments: vi.fn().mockReturnValue(docs),
      listDocumentsForUser: vi.fn((userId: string, systemId: string) =>
        docs.filter(
          (doc) => doc.userId === userId || doc.userId === systemId,
        ),
      ),
      listDocumentsByUserId: vi.fn(),
      countDocumentsByUserId: vi.fn(),
      getDocument: vi.fn((id: string) => docs.find((doc) => doc.id === id)),
      deleteDocument: vi.fn(),
    };

    const config = {
      AUTH_ENABLED: true,
      API_KEY: "service-key",
      USER_AUTH_ENABLED: true,
    } as AppConfig;

    const app = Fastify();
    await registerBearerAuthIfEnabled(app, config);
    const routeOpts = createProtectedRouteOpts(config, app, authProvider);
    await registerDocumentRoutes(app, {
      ingestionService: { ingest: async () => ({}) } as never,
      registry: registry as never,
      vectorStore: { deleteByDocumentId: async () => {} } as never,
      uploadsDir: tempDir,
      defaultCollection: "default",
      systemUserId,
      routeOpts,
    });

    return {
      app,
      tokenA: userA.tokens.accessToken,
      tokenB: userB.tokens.accessToken,
    };
  }

  it("returns 401 without Authorization when USER_AUTH_ENABLED", async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
    });
    expect(response.statusCode).toBe(401);
  });

  it("user A cannot GET user B document by id (404)", async () => {
    const { app, tokenA } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents/doc-b",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("both users see system legacy document in list", async () => {
    const { app, tokenA, tokenB } = await buildApp();

    const listA = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const listB = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(listA.statusCode).toBe(200);
    expect(listB.statusCode).toBe(200);
    const idsA = (listA.json() as { id: string }[]).map((doc) => doc.id);
    const idsB = (listB.json() as { id: string }[]).map((doc) => doc.id);
    expect(idsA).toContain("doc-system");
    expect(idsB).toContain("doc-system");
    expect(idsA).not.toContain("doc-b");
    expect(idsB).not.toContain("doc-a");
  });

  it("user A cannot delete system legacy document (404)", async () => {
    const { app, tokenA } = await buildApp();
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/documents/doc-system",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it("API_KEY service mode sees all documents", async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
      headers: { authorization: "Bearer service-key" },
    });
    expect(response.statusCode).toBe(200);
    const ids = (response.json() as { id: string }[]).map((doc) => doc.id);
    expect(ids).toEqual(
      expect.arrayContaining(["doc-a", "doc-b", "doc-system"]),
    );
  });
});
