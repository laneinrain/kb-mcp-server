import type { AuthUser } from "@kb/auth";

export type AuthMode = "user" | "service";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
    authMode?: AuthMode;
  }
}
