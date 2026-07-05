import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  AuthValidationError,
  type AuthProvider,
} from "@kb/auth";

const loginBodySchema = z.object({
  employeeId: z.string(),
  password: z.string().min(1, "密码不能为空"),
});

export interface AuthRoutesDeps {
  authProvider: AuthProvider | null;
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
}
