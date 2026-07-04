import bearerAuth from "@fastify/bearer-auth";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@kb/config";

export async function registerBearerAuthIfEnabled(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  if (!config.AUTH_ENABLED) return;

  await app.register(bearerAuth, {
    keys: new Set([config.API_KEY!]),
    addHook: false,
  });
}

export function apiRouteOpts(config: AppConfig, app: FastifyInstance) {
  return config.AUTH_ENABLED
    ? { preHandler: [app.verifyBearerAuth] }
    : {};
}
