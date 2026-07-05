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

const SettingsResponseSchema = z.object({
  chunk: z.object({
    chunkSize: z.number(),
    chunkOverlap: z.number(),
  }),
  context: ContextSettingsSchema,
});

const ContextPatchResponseSchema = z.object({
  context: ContextSettingsSchema,
});

export interface SettingsDeps {
  settingsStore: SettingsStore;
  routeOpts?: ApiRouteOpts;
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  deps: SettingsDeps,
): Promise<void> {
  const opts = deps.routeOpts ?? {};

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
}
