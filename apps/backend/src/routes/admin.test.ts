import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMPLOYEE_ID,
  MockCasAuthProvider,
  UserStore,
  hashPassword,
  openAuthDatabase,
} from "@kb/auth";
import type { DocumentRecord } from "@kb/core";
import type { AppConfig } from "@kb/config";
import {
  createAdminRouteOpts,
  createProtectedRouteOpts,
  registerBearerAuthIfEnabled,
} from "../auth.js";
import { registerAdminRoutes } from "./admin.js";
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

describe("admin routes", () => {
  let tempDir: string;
  let authProvider: MockCasAuthProvider | null = null;

  afterEach(() => {
    authProvider?.close();
    authProvider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup races
      }
    }
  });

  async function buildApp() {
    tempDir = mkdtempSync(join(tmpdir(), "kb-admin-route-test-"));
    const dbPath = join(tempDir, "auth.db");
    const authDb = openAuthDatabase(dbPath);
    const store = new UserStore(authDb);
    store.ensureAdminUser(await hashPassword(ADMIN_DEFAULT_PASSWORD));
    authDb.close();

    authProvider = new MockCasAuthProvider({
      dbPath,
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    const adminLogin = await authProvider.login({
      employeeId: ADMIN_EMPLOYEE_ID,
      password: ADMIN_DEFAULT_PASSWORD,
    });
    const userLogin = await authProvider.login({
      employeeId: "12345678",
      password: "any",
    });

    const docs = [
      createDoc("doc-a", userLogin.user.id, "a.txt"),
      createDoc("doc-b", "other-user", "b.txt"),
    ];

    const registry = {
      listDocuments: vi.fn().mockReturnValue(docs),
      listDocumentsForUser: vi.fn(),
      listDocumentsByUserId: vi.fn((userId: string) =>
        docs.filter((doc) => doc.userId === userId),
      ),
      countDocumentsByUserId: vi.fn((userId: string) =>
        docs.filter((doc) => doc.userId === userId).length,
      ),
      getDocument: vi.fn((id: string) => docs.find((doc) => doc.id === id)),
      deleteDocument: vi.fn(),
      findByUserAndFilename: vi.fn(),
      registerDocument: vi.fn(),
      updateStatus: vi.fn(),
      trackChunkIds: vi.fn(),
      getChunkIds: vi.fn().mockReturnValue([]),
    };

    const config = {
      USER_AUTH_ENABLED: true,
      AUTH_ENABLED: true,
      API_KEY: "service-key",
    } as AppConfig;

    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(fastifyMultipart);
    await registerBearerAuthIfEnabled(app, config);
    const adminRouteOpts = createAdminRouteOpts(config, app, authProvider);
    await registerAdminRoutes(app, {
      authProvider,
      authSqlitePath: dbPath,
      registry: registry as never,
      ingestionService: { ingest: vi.fn() } as never,
      vectorStore: { deleteByDocumentId: vi.fn() } as never,
      uploadsDir: join(tempDir, "uploads"),
      defaultCollection: "default",
      routeOpts: adminRouteOpts,
    });

    return {
      app,
      adminToken: adminLogin.tokens.accessToken,
      userToken: userLogin.tokens.accessToken,
      userId: userLogin.user.id,
      registry,
    };
  }

  it("GET /api/v1/admin/users returns all users for admin JWT", async () => {
    const { app, adminToken } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{
      employeeId: string;
      role: string;
      documentCount: number;
    }>;
    expect(body.some((user) => user.employeeId === ADMIN_EMPLOYEE_ID)).toBe(true);
    expect(body.some((user) => user.employeeId === "12345678")).toBe(true);
  });

  it("GET /api/v1/admin/users returns 403 for non-admin JWT", async () => {
    const { app, userToken } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("GET /api/v1/admin/users works with API_KEY service mode", async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users",
      headers: { authorization: "Bearer service-key" },
    });

    expect(response.statusCode).toBe(200);
  });

  it("GET /api/v1/admin/users/:userId/documents lists target user docs", async () => {
    const { app, adminToken, userId } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/admin/users/${userId}/documents`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ id: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe("doc-a");
  });

  it("GET /api/v1/admin/documents/:documentId returns any document", async () => {
    const { app, adminToken } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/documents/doc-b",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "doc-b" });
  });

  it("DELETE /api/v1/admin/documents/:documentId deletes any document", async () => {
    const { app, adminToken, registry } = await buildApp();
    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/admin/documents/doc-b",
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(registry.deleteDocument).toHaveBeenCalledWith("doc-b");
  });

  it("non-admin JWT cannot access admin document routes", async () => {
    const { app, userToken } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/documents/doc-a",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("POST upload on behalf assigns target userId", async () => {
    const ingest = vi.fn().mockResolvedValue({
      documentId: "doc-upload",
      chunkCount: 1,
      collection: "default",
      outcome: "created",
    });

    const config = {
      USER_AUTH_ENABLED: true,
      AUTH_ENABLED: true,
      API_KEY: "service-key",
    } as AppConfig;

    const uploadApp = Fastify().withTypeProvider<ZodTypeProvider>();
    uploadApp.setValidatorCompiler(validatorCompiler);
    uploadApp.setSerializerCompiler(serializerCompiler);
    await uploadApp.register(fastifyMultipart);
    await registerBearerAuthIfEnabled(uploadApp, config);

    const tempDir2 = mkdtempSync(join(tmpdir(), "kb-admin-upload-"));
    const dbPath = join(tempDir2, "auth.db");
    const authDb = openAuthDatabase(dbPath);
    new UserStore(authDb).ensureAdminUser(
      await hashPassword(ADMIN_DEFAULT_PASSWORD),
    );
    authDb.close();

    const provider = new MockCasAuthProvider({
      dbPath,
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });
    const adminLogin = await provider.login({
      employeeId: ADMIN_EMPLOYEE_ID,
      password: ADMIN_DEFAULT_PASSWORD,
    });
    const userLogin = await provider.login({
      employeeId: "12345678",
      password: "any",
    });

    await registerAdminRoutes(uploadApp, {
      authProvider: provider,
      authSqlitePath: dbPath,
      registry: {
        listDocumentsByUserId: vi.fn(),
        countDocumentsByUserId: vi.fn(),
        getDocument: vi.fn(),
        deleteDocument: vi.fn(),
        listDocuments: vi.fn(),
        listDocumentsForUser: vi.fn(),
        findByUserAndFilename: vi.fn(),
        registerDocument: vi.fn(),
        updateStatus: vi.fn(),
        trackChunkIds: vi.fn(),
        getChunkIds: vi.fn(),
      } as never,
      ingestionService: { ingest } as never,
      vectorStore: { deleteByDocumentId: vi.fn() } as never,
      uploadsDir: join(tempDir2, "uploads"),
      defaultCollection: "default",
      routeOpts: createAdminRouteOpts(config, uploadApp, provider),
    });

    const boundary = "----admin-upload";
    const response = await uploadApp.inject({
      method: "POST",
      url: `/api/v1/admin/users/${userLogin.user.id}/documents`,
      headers: {
        authorization: `Bearer ${adminLogin.tokens.accessToken}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload:
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="sample.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `hello\r\n` +
        `--${boundary}--\r\n`,
    });

    expect(response.statusCode).toBe(201);
    expect(ingest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: userLogin.user.id }),
    );
    provider.close();
    rmSync(tempDir2, { recursive: true, force: true });
  });
});

describe("createAdminRouteOpts vs createProtectedRouteOpts", () => {
  it("regular protected routes still allow non-admin JWT users", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "kb-admin-compare-"));
    const authProvider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    const userLogin = await authProvider.login({
      employeeId: "12345678",
      password: "any",
    });

    const config = {
      USER_AUTH_ENABLED: true,
      AUTH_ENABLED: false,
    } as AppConfig;

    const app = Fastify();
    const routeOpts = createProtectedRouteOpts(config, app, authProvider);

    app.get("/api/v1/documents", routeOpts, async () => [{ id: "doc-a" }]);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
      headers: { authorization: `Bearer ${userLogin.tokens.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    authProvider.close();
    rmSync(tempDir, { recursive: true, force: true });
  });
});
