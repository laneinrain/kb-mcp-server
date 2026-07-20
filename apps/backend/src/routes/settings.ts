import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";
import type { SettingsStore } from "@kb/core";
import { mapContextSettingsError } from "../lib/errors.js";
import type { ApiRouteOpts } from "../auth.js";

const ContextSettingsSchema = z
  .object({
    readAroundWindowDefault: z.number().int().min(1).max(10),
    readAroundWindowMax: z.number().int().min(1).max(10),
    readAroundMaxChars: z.number().int().min(1000),
    readFileMaxChunks: z.number().int().min(1),
    readFileMaxChars: z.number().int().min(1000),
  })
  .refine(
    (data) => data.readAroundWindowMax >= data.readAroundWindowDefault,
    { message: "readAroundWindowMax must be >= readAroundWindowDefault" },
  );

const ModelSettingsSchema = z.object({
  embeddingModel: z.string().trim().min(1),
  rerankEnabled: z.boolean(),
  rerankModel: z.string().trim().min(1),
  rerankCandidates: z.number().int().min(1).max(50),
});

const SettingsResponseSchema = z.object({
  chunk: z.object({
    chunkSize: z.number(),
    chunkOverlap: z.number(),
  }),
  context: ContextSettingsSchema,
  models: ModelSettingsSchema,
  embeddingDimensions: z.number().int().positive(),
});

const ContextPatchResponseSchema = z.object({
  context: ContextSettingsSchema,
});

const ModelPatchResponseSchema = z.object({
  models: ModelSettingsSchema,
});

export interface SettingsDeps {
  settingsStore: SettingsStore;
  embeddingDimensions: number;
  routeOpts?: ApiRouteOpts;
  /** Admin (or service) only — PATCH /settings/models */
  modelsRouteOpts?: ApiRouteOpts;
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  deps: SettingsDeps,
): Promise<void> {
  const opts = deps.routeOpts ?? {};
  const modelsOpts = deps.modelsRouteOpts ?? opts;

  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/v1/settings",
    {
      ...opts,
      schema: {
        response: {
          200: SettingsResponseSchema,
        },
      },
    },
    async () => ({
      chunk: deps.settingsStore.getChunkConfig(),
      context: deps.settingsStore.getContextConfig(),
      models: deps.settingsStore.getModelConfig(),
      embeddingDimensions: deps.embeddingDimensions,
    }),
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    "/api/v1/settings/context",
    {
      ...opts,
      schema: {
        body: ContextSettingsSchema,
        response: {
          200: ContextPatchResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const updated = deps.settingsStore.updateContextConfig(request.body);
        return { context: updated };
      } catch (error) {
        const mapped = mapContextSettingsError(error);
        return (reply as FastifyReply).status(mapped.statusCode).send(mapped.body);
      }
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    "/api/v1/settings/models",
    {
      ...modelsOpts,
      schema: {
        body: ModelSettingsSchema,
        response: {
          200: ModelPatchResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const updated = deps.settingsStore.updateModelConfig(request.body);
        return { models: updated };
      } catch (error) {
        const mapped = mapContextSettingsError(error);
        return (reply as FastifyReply).status(mapped.statusCode).send(mapped.body);
      }
    },
  );
}
