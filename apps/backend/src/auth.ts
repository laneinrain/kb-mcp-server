import bearerAuth from "@fastify/bearer-auth";
import type { AuthProvider } from "@kb/auth";
import type { AppConfig } from "@kb/config";
import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import "./types.js";

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

export function createProtectedRouteOpts(
  config: AppConfig,
  app: FastifyInstance,
  authProvider: AuthProvider | null,
): ApiRouteOpts {
  if (!config.USER_AUTH_ENABLED) {
    return apiRouteOpts(config, app);
  }

  if (!authProvider) {
    throw new Error("authProvider required when USER_AUTH_ENABLED");
  }

  return {
    preHandler: async (request, reply) => {
      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Missing Bearer token",
        });
      }

      const token = header.slice(7);

      try {
        request.authUser = await authProvider.validateAccessToken(token);
        request.authMode = "user";
        return;
      } catch {
        // Fall through to service API key when enabled.
      }

      if (config.AUTH_ENABLED && config.API_KEY && token === config.API_KEY) {
        request.authMode = "service";
        return;
      }

      return reply.code(401).send({
        error: "unauthorized",
        message: "Invalid or expired token",
      });
    },
  };
}

export function createAdminRouteOpts(
  config: AppConfig,
  app: FastifyInstance,
  authProvider: AuthProvider | null,
): ApiRouteOpts {
  const base = createProtectedRouteOpts(config, app, authProvider);
  const baseHandlers = Array.isArray(base.preHandler)
    ? base.preHandler
    : base.preHandler
      ? [base.preHandler]
      : [];

  return {
    preHandler: [
      ...baseHandlers,
      async (request, reply) => {
        if (request.authMode === "service") {
          return;
        }
        if (request.authUser?.role === "admin") {
          return;
        }
        return reply.code(403).send({
          error: "forbidden",
          message: "Admin access required",
        });
      },
    ],
  };
}
