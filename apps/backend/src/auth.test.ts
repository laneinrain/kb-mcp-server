import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@kb/config";
import { apiRouteOpts, registerBearerAuthIfEnabled } from "./auth.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";

const authEnabledConfig = {
  AUTH_ENABLED: true,
  API_KEY: "test-api-key",
} as AppConfig;

const authDisabledConfig = {
  AUTH_ENABLED: false,
} as AppConfig;

function createMockRegistry() {
  return {
    listDocuments: vi.fn().mockReturnValue([]),
    listDocumentsForUser: vi.fn().mockReturnValue([]),
    getDocument: vi.fn(),
    deleteDocument: vi.fn(),
  };
}

async function buildProtectedApp(config: AppConfig) {
  const app = Fastify();
  await registerHealthRoutes(app, {
    vectorStore: { heartbeat: vi.fn() } as never,
    embeddingClient: { ping: vi.fn() } as never,
    getEmbeddingModel: () => "test-embed-model",
  });
  await registerBearerAuthIfEnabled(app, config);
  const routeOpts = apiRouteOpts(config, app);
  await registerDocumentRoutes(app, {
    ingestionService: { ingest: vi.fn() } as never,
    registry: createMockRegistry() as never,
    vectorStore: { deleteByDocumentId: vi.fn() } as never,
    uploadsDir: "./data/uploads",
    defaultCollection: "default",
    systemUserId: null,
    routeOpts,
  });
  return app;
}

describe("registerBearerAuthIfEnabled", () => {
  it("returns 401 for GET /api/v1/documents without Authorization when auth enabled", async () => {
    const app = await buildProtectedApp(authEnabledConfig);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns 200 for GET /api/v1/documents with valid Bearer token when auth enabled", async () => {
    const app = await buildProtectedApp(authEnabledConfig);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });
    expect(response.statusCode).toBe(200);
  });

  it("returns 200 for GET /health without Authorization when auth enabled", async () => {
    const app = await buildProtectedApp(authEnabledConfig);
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 200 for GET /api/v1/documents without Authorization when auth disabled", async () => {
    const app = await buildProtectedApp(authDisabledConfig);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
    });
    expect(response.statusCode).toBe(200);
  });
});
