import type { AuthProvider, AuthUser } from "./types.js";

export type JwtPreHandler = (
  request: { headers: { authorization?: string }; authUser?: AuthUser },
  reply: {
    code: (status: number) => { send: (body: unknown) => unknown };
  },
) => Promise<unknown>;

export function createJwtPreHandler(provider: AuthProvider): JwtPreHandler {
  return async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Missing Bearer token",
      });
    }

    try {
      request.authUser = await provider.validateAccessToken(header.slice(7));
    } catch {
      return reply.code(401).send({
        error: "unauthorized",
        message: "Invalid or expired token",
      });
    }
  };
}
