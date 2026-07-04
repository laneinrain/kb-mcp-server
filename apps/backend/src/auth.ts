import bearerAuth from "@fastify/bearer-auth";
import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { AppConfig } from "@kb/config";

export type ApiRouteOpts = {
  preHandler?: preHandlerHookHandler | preHandlerHookHandler[];
};

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

export function apiRouteOpts(
  config: AppConfig,
  app: FastifyInstance,
): ApiRouteOpts {
  if (!config.AUTH_ENABLED) {
    return {};
  }

  const verify = app.verifyBearerAuth;
  if (!verify) {
    throw new Error("Bearer auth plugin not registered");
  }

  return { preHandler: [verify] };
}
