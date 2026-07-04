import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";
import type { SearchService } from "@kb/core";
import { mapSearchError } from "../lib/errors.js";

const SearchBodySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(10).optional(),
  collection: z.string().optional(),
});

const SearchResponseSchema = z.object({
  results: z.array(
    z.object({
      score: z.number(),
      text: z.string(),
      documentId: z.string(),
      filename: z.string(),
      chunkIndex: z.number(),
    }),
  ),
});

export interface SearchDeps {
  searchService: SearchService;
  routeOpts?: { preHandler?: unknown[] };
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  deps: SearchDeps,
): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/v1/search",
    {
      ...(deps.routeOpts ?? {}),
      schema: {
        body: SearchBodySchema,
        response: {
          200: SearchResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const results = await deps.searchService.search(request.body.query, {
          topK: request.body.topK,
          collection: request.body.collection,
        });
        return { results };
      } catch (error) {
        const mapped = mapSearchError(error);
        return (reply as FastifyReply).status(mapped.statusCode).send(mapped.body);
      }
    },
  );
}
