import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  AuthConflictError,
  AuthValidationError,
  type AuthProvider,
  type MockCasAuthProvider,
} from "@kb/auth";

const loginBodySchema = z.object({
  employeeId: z.string(),
  password: z.string().min(1, "密码不能为空"),
});

const registerBodySchema = z.object({
  employeeId: z.string(),
  password: z.string().min(8, "密码至少 8 位"),
});

export interface AuthRoutesDeps {
  authProvider: AuthProvider | null;
  casMock: boolean;
}

function hasRegister(
  provider: AuthProvider,
): provider is MockCasAuthProvider {
  return typeof (provider as MockCasAuthProvider).register === "function";
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthRoutesDeps,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/v1/auth/login",
    {
      schema: {
        body: loginBodySchema,
      },
    },
    async (request, reply) => {
      if (!deps.authProvider) {
        return reply.code(404).send({
          error: "not_found",
          message: "User auth is disabled",
        });
      }

      const { employeeId, password } = request.body;

      try {
        const result = await deps.authProvider.login({ employeeId, password });
        return reply.code(200).send({
          accessToken: result.tokens.accessToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn,
          user: {
            id: result.user.id,
            employeeId: result.user.employeeId,
            email: result.user.email,
            role: result.user.role,
          },
        });
      } catch (error) {
        if (error instanceof AuthValidationError) {
          return reply.code(400).send({
            error: "bad_request",
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  typed.post(
    "/api/v1/auth/register",
    {
      schema: {
        body: registerBodySchema,
      },
    },
    async (request, reply) => {
      if (!deps.authProvider || !deps.casMock) {
        return reply.code(404).send({
          error: "not_found",
          message: "User auth is disabled",
        });
      }

      if (!hasRegister(deps.authProvider)) {
        return reply.code(404).send({
          error: "not_found",
          message: "User auth is disabled",
        });
      }

      const { employeeId, password } = request.body;

      try {
        const user = await deps.authProvider.register({ employeeId, password });
        return reply.code(201).send({
          user: {
            id: user.id,
            employeeId: user.employeeId,
            email: user.email,
            role: user.role,
          },
        });
      } catch (error) {
        if (error instanceof AuthValidationError) {
          return reply.code(400).send({
            error: "bad_request",
            message: error.message,
          });
        }
        if (error instanceof AuthConflictError) {
          return reply.code(409).send({
            error: "conflict",
            message: error.message,
          });
        }
        throw error;
      }
    },
  );
}
