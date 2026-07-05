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

async function buildApp() {
  const settingsStore = {
    getChunkConfig: vi.fn().mockReturnValue({ chunkSize: 1024, chunkOverlap: 154 }),
    getContextConfig: vi.fn().mockReturnValue(DEFAULT_CONTEXT),
    updateContextConfig: vi.fn().mockImplementation((patch) => ({
      ...DEFAULT_CONTEXT,
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

  await registerSettingsRoutes(app, { settingsStore: settingsStore as never });

  return { app, settingsStore };
}

describe("registerSettingsRoutes", () => {
  it("GET /api/v1/settings returns chunk and context groups", async () => {
    const { app, settingsStore } = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/settings",
    });

    expect(response.statusCode).toBe(200);
    expect(settingsStore.getChunkConfig).toHaveBeenCalled();
    expect(settingsStore.getContextConfig).toHaveBeenCalled();
    expect(response.json()).toEqual({
      chunk: { chunkSize: 1024, chunkOverlap: 154 },
      context: DEFAULT_CONTEXT,
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
});

describe("createAppServices", () => {
  it("exposes settingsStore and contextService", async () => {
    const services = await createAppServices();

    expect(services.settingsStore).toBeDefined();
    expect(typeof services.settingsStore.getContextConfig).toBe("function");
    expect(services.contextService).toBeDefined();
    expect(typeof services.contextService.readAround).toBe("function");
    expect(typeof services.contextService.readFile).toBe("function");
  });
});
