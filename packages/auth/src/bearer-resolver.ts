import type { AuthProvider, AuthUser } from "./types.js";

export type BearerAuthMode = "user" | "service" | "none";

export interface BearerAuthResult {
  mode: BearerAuthMode;
  user?: AuthUser;
}

export interface ResolveBearerTokenDeps {
  userAuthEnabled: boolean;
  authEnabled: boolean;
  apiKey?: string;
  authProvider: AuthProvider | null;
}

export class BearerAuthError extends Error {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = "BearerAuthError";
  }
}

export async function resolveBearerToken(
  token: string | undefined,
  deps: ResolveBearerTokenDeps,
): Promise<BearerAuthResult> {
  if (!deps.userAuthEnabled) {
    return { mode: "none" };
  }

  if (!token) {
    throw new BearerAuthError("Missing Bearer token");
  }

  if (!deps.authProvider) {
    throw new BearerAuthError("Invalid or expired token");
  }

  try {
    const user = await deps.authProvider.validateAccessToken(token);
    return { mode: "user", user };
  } catch {
    // Fall through to service API key when enabled.
  }

  if (deps.authEnabled && deps.apiKey && token === deps.apiKey) {
    return { mode: "service" };
  }

  throw new BearerAuthError("Invalid or expired token");
}
