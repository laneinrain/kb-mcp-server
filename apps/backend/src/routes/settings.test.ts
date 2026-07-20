import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { createAppServices } from "../services.js";
import { registerSettingsRoutes } from "./settings.js";

const DEFAULT_CONTEXT = {
  readAroundWindowDefault: 1,
  readAroundWindowMax: 3,
  readAroundMaxChars: 32000,
  readFileMaxChunks: 50,
  readFileMaxChars: 64000,
};

const DEFAULT_MODELS = {
  embeddingBaseUrl: "https://open.cherryin.cc/v1",
  embeddingModel: "qwen/qwen3-embedding-8b",
  rerankEnabled: true,
  rerankBaseUrl: "https://open.cherryin.cc/v1",
  rerankModel: "qwen/qwen3-reranker-0.6b",
  rerankCandidates: 30,
};

async function buildApp() {
  const settingsStore = {
    getChunkConfig: vi.fn().mockReturnValue({ chunkSize: 1024, chunkOverlap: 154 }),
    getContextConfig: vi.fn().mockReturnValue(DEFAULT_CONTEXT),
    updateContextConfig: vi.fn().mockImplementation((patch) => ({
      ...DEFAULT_CONTEXT,
      ...patch,
    })),
    getModelConfig: vi.fn().mockReturnValue(DEFAULT_MODELS),
    updateModelConfig: vi.fn().mockImplementation((patch) => ({
      ...DEFAULT_MODELS,
      ...patch,
    })),
  };

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { validation?: unknown; statusCode?: number };

    if (err.validation) {
      reply.code(400);
      return {
        error: "validation_error",
        message: err.message,
      };
    }

    reply.code(err.statusCode ?? 500);
    return {
      error: "internal_error",
      message: err.message,
    };
  });

  await registerSettingsRoutes(app, {
    settingsStore: settingsStore as never,
    embeddingDimensions: 1024,
  });

  return { app, settingsStore };
}

describe("registerSettingsRoutes", () => {
  it("GET /api/v1/settings returns chunk, context, models, and embeddingDimensions", async () => {
    const { app, settingsStore } = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/settings",
    });

    expect(response.statusCode).toBe(200);
    expect(settingsStore.getChunkConfig).toHaveBeenCalled();
    expect(settingsStore.getContextConfig).toHaveBeenCalled();
    expect(settingsStore.getModelConfig).toHaveBeenCalled();
    expect(response.json()).toEqual({
      chunk: { chunkSize: 1024, chunkOverlap: 154 },
      context: DEFAULT_CONTEXT,
      models: DEFAULT_MODELS,
      embeddingDimensions: 1024,
    });
  });

  it("PATCH /api/v1/settings/context with valid body returns updated context", async () => {
    const { app, settingsStore } = await buildApp();

    const payload = {
      ...DEFAULT_CONTEXT,
      readAroundMaxChars: 30000,
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings/context",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(settingsStore.updateContextConfig).toHaveBeenCalledWith(payload);
    expect(response.json()).toEqual({
      context: {
        ...DEFAULT_CONTEXT,
        readAroundMaxChars: 30000,
      },
    });
  });

  it("PATCH with readAroundWindowMax < readAroundWindowDefault returns 400 validation_error", async () => {
    const { app } = await buildApp();

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings/context",
      payload: {
        ...DEFAULT_CONTEXT,
        readAroundWindowDefault: 5,
        readAroundWindowMax: 2,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "validation_error",
    });
  });

  it("PATCH /api/v1/settings/models with valid body returns updated models", async () => {
    const { app, settingsStore } = await buildApp();

    const payload = {
      ...DEFAULT_MODELS,
      embeddingModel: "custom/embed",
      rerankCandidates: 20,
    };

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings/models",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(settingsStore.updateModelConfig).toHaveBeenCalledWith(payload);
    expect(response.json()).toEqual({
      models: {
        ...DEFAULT_MODELS,
        embeddingModel: "custom/embed",
        rerankCandidates: 20,
      },
    });
  });

  it("PATCH /api/v1/settings/models with invalid candidates returns 400", async () => {
    const { app } = await buildApp();

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings/models",
      payload: {
        ...DEFAULT_MODELS,
        rerankCandidates: 51,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "validation_error",
    });
  });

  it("PATCH /api/v1/settings/models maps store validation errors to 400", async () => {
    const { app, settingsStore } = await buildApp();
    settingsStore.updateModelConfig.mockImplementation(() => {
      throw new Error(
        "rerankCandidates must be an integer between 1 and 50",
      );
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings/models",
      payload: DEFAULT_MODELS,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "validation_error",
      message: expect.stringContaining("rerankCandidates"),
    });
  });

  it("PATCH /api/v1/settings/models uses modelsRouteOpts (admin gate)", async () => {
    const settingsStore = {
      getChunkConfig: vi.fn().mockReturnValue({ chunkSize: 1024, chunkOverlap: 154 }),
      getContextConfig: vi.fn().mockReturnValue(DEFAULT_CONTEXT),
      updateContextConfig: vi.fn(),
      getModelConfig: vi.fn().mockReturnValue(DEFAULT_MODELS),
      updateModelConfig: vi.fn(),
    };

    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await registerSettingsRoutes(app, {
      settingsStore: settingsStore as never,
      embeddingDimensions: 1024,
      modelsRouteOpts: {
        preHandler: async (_request, reply) => {
          return reply.code(403).send({
            error: "forbidden",
            message: "Admin access required",
          });
        },
      },
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings/models",
      payload: DEFAULT_MODELS,
    });

    expect(response.statusCode).toBe(403);
    expect(settingsStore.updateModelConfig).not.toHaveBeenCalled();
  });
});

describe("createAppServices", () => {
  it("exposes settingsStore and contextService", async () => {
    const services = await createAppServices();

    expect(services.settingsStore).toBeDefined();
    expect(typeof services.settingsStore.getContextConfig).toBe("function");
    expect(typeof services.settingsStore.getModelConfig).toBe("function");
    expect(services.contextService).toBeDefined();
    expect(typeof services.contextService.readAround).toBe("function");
    expect(typeof services.contextService.readFile).toBe("function");
  });
});
