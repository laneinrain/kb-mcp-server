import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { describe, expect, it, vi } from "vitest";
import type { DocumentRecord } from "@kb/core";
import { registerDocumentRoutes } from "./documents.js";

function createSampleDoc(id = "doc-1"): DocumentRecord {
  return {
    id,
    filename: "sample.txt",
    sourcePath: "/data/uploads/sample.txt",
    mimeType: "text/plain",
    status: "indexed",
    chunkCount: 2,
    collection: "default",
    userId: "user-1",
    createdAt: "2026-06-29T00:00:00.000Z",
    updatedAt: "2026-06-29T00:00:00.000Z",
  };
}

async function buildApp(deps?: Partial<Parameters<typeof registerDocumentRoutes>[1]>) {
  const ingestionService = {
    ingest: vi.fn(),
  };
  const registry = {
    listDocuments: vi.fn().mockReturnValue([createSampleDoc()]),
    getDocument: vi.fn(),
    deleteDocument: vi.fn(),
  };
  const vectorStore = {
    deleteByDocumentId: vi.fn().mockResolvedValue(undefined),
  };

  const app = Fastify();
  await app.register(fastifyMultipart);
  await registerDocumentRoutes(app, {
    ingestionService: ingestionService as never,
    registry: registry as never,
    vectorStore: vectorStore as never,
    uploadsDir: "./data/uploads",
    defaultCollection: "default",
    systemUserId: null,
    ...deps,
  });

  return {
    app,
    ingestionService,
    registry,
    vectorStore,
  };
}

describe("registerDocumentRoutes", () => {
  it("POST /api/v1/documents without file returns 400", async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/documents",
      headers: {
        "content-type": "multipart/form-data; boundary=----test",
      },
      payload: "------test--\r\n",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "bad_request",
    });
  });

  it("GET /api/v1/documents returns list omitting sourcePath", async () => {
    const { app } = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Record<string, unknown>[];
    expect(body[0]).not.toHaveProperty("sourcePath");
    expect(body[0]).toHaveProperty("filename", "sample.txt");
  });

  it("GET /api/v1/documents/:id returns 404 for unknown id", async () => {
    const registry = {
      listDocuments: vi.fn().mockReturnValue([]),
      getDocument: vi.fn().mockReturnValue(undefined),
      deleteDocument: vi.fn(),
    };
    const { app } = await buildApp({ registry: registry as never });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents/missing-id",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("DELETE /api/v1/documents/:id calls deleteByDocumentId before registry.deleteDocument", async () => {
    const doc = createSampleDoc("doc-delete");
    const order: string[] = [];
    const registry = {
      listDocuments: vi.fn().mockReturnValue([]),
      getDocument: vi.fn().mockReturnValue(doc),
      deleteDocument: vi.fn().mockImplementation(() => {
        order.push("registry");
      }),
    };
    const vectorStore = {
      deleteByDocumentId: vi.fn().mockImplementation(async () => {
        order.push("chroma");
      }),
    };
    const { app } = await buildApp({
      registry: registry as never,
      vectorStore: vectorStore as never,
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/documents/doc-delete",
    });

    expect(response.statusCode).toBe(200);
    expect(vectorStore.deleteByDocumentId).toHaveBeenCalledWith(
      "doc-delete",
      "default",
    );
    expect(registry.deleteDocument).toHaveBeenCalledWith("doc-delete");
    expect(order).toEqual(["chroma", "registry"]);
  });

  it("DELETE /api/v1/documents/:id returns 404 when missing", async () => {
    const registry = {
      listDocuments: vi.fn().mockReturnValue([]),
      getDocument: vi.fn().mockReturnValue(undefined),
      deleteDocument: vi.fn(),
    };
    const { app } = await buildApp({ registry: registry as never });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/documents/missing-id",
    });

    expect(response.statusCode).toBe(404);
  });
});
