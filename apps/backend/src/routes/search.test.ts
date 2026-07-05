import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { registerSearchRoutes } from "./search.js";

async function buildApp() {
  const searchService = {
    search: vi.fn().mockResolvedValue([
      {
        score: 0.85,
        text: "sample content",
        documentId: "doc-1",
        filename: "sample.txt",
        chunkIndex: 0,
      },
    ]),
  };

  const registry = {
    listDocuments: vi.fn().mockReturnValue([]),
    listDocumentsForUser: vi.fn().mockReturnValue([]),
  };

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerSearchRoutes(app, {
    searchService: searchService as never,
    registry: registry as never,
    systemUserId: null,
  });

  return { app, searchService };
}

describe("registerSearchRoutes", () => {
  it("POST /api/v1/search delegates to searchService.search", async () => {
    const { app, searchService } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/search",
      payload: {
        query: "sample content",
        topK: 3,
        collection: "default",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(searchService.search).toHaveBeenCalledWith("sample content", {
      topK: 3,
      collection: "default",
    });
    expect(response.json()).toMatchObject({
      results: [
        expect.objectContaining({
          score: 0.85,
          documentId: "doc-1",
          chunkIndex: 0,
        }),
      ],
    });
  });

  it("POST /api/v1/search rejects empty query with 400", async () => {
    const { app } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/search",
      payload: { query: "" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("POST /api/v1/search rejects topK above 10 with 400", async () => {
    const { app } = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/search",
      payload: { query: "hello", topK: 11 },
    });

    expect(response.statusCode).toBe(400);
  });
});
