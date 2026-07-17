import {
  BearerAuthError,
  resolveBearerToken,
  type AuthProvider,
} from "@kb/auth";
import type { AppConfig } from "@kb/config";
import type { DocumentRegistry } from "@kb/core";
import type { McpCallerContext } from "./types.js";

export class McpAuthError extends Error {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

export interface McpAuthResolverDeps {
  config: AppConfig;
  authProvider: AuthProvider | null;
  registry: DocumentRegistry;
  systemUserId: string | null;
}

export class McpAuthResolver {
  constructor(private readonly deps: McpAuthResolverDeps) {}

  async resolve(token: string | undefined): Promise<McpCallerContext> {
    try {
      const mcpAuthActive =
        this.deps.config.USER_AUTH_ENABLED &&
        this.deps.config.MCP_AUTH_REQUIRED;

      const result = await resolveBearerToken(token, {
        userAuthEnabled: mcpAuthActive,
        authEnabled: this.deps.config.AUTH_ENABLED,
        apiKey: this.deps.config.API_KEY,
        authProvider: this.deps.authProvider,
      });

      if (result.mode === "none") {
        return { authMode: "global" };
      }

      if (result.mode === "service") {
        return { authMode: "service" };
      }

      const user = result.user;
      if (!user) {
        throw new McpAuthError("Invalid or expired token");
      }

      if (!this.deps.systemUserId) {
        throw new McpAuthError("Invalid or expired token");
      }

      const allowedDocumentIds = new Set(
        this.deps.registry
          .listDocumentsForUser(user.id, this.deps.systemUserId)
          .map((doc) => doc.id),
      );

      return {
        authMode: "user",
        authUser: user,
        allowedDocumentIds,
      };
    } catch (error) {
      if (error instanceof McpAuthError) {
        throw error;
      }
      if (error instanceof BearerAuthError) {
        throw new McpAuthError(error.message);
      }
      throw new McpAuthError("Invalid or expired token");
    }
  }
}
