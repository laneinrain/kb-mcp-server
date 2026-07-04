import fastifyStatic from "@fastify/static";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

export function shouldServeWeb(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.SERVE_WEB === "true"
  );
}

export async function registerWebStatic(app: FastifyInstance): Promise<void> {
  if (!shouldServeWeb()) {
    return;
  }

  const distRoot = join(import.meta.dirname, "../../web/dist");

  await app.register(fastifyStatic, {
    root: distRoot,
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({
        error: "not_found",
        message: "Unknown API route",
      });
    }
    return reply.sendFile("index.html");
  });
}
