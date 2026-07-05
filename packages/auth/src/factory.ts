import type { AuthProvider } from "./types.js";
import { CasAuthProvider } from "./cas-auth-provider.js";
import { MockCasAuthProvider } from "./mock-cas-auth-provider.js";

export interface CreateAuthProviderOptions {
  dbPath: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  authProvider: "cas" | "local";
  casMock: boolean;
  casServerUrl?: string;
}

export function createAuthProvider(
  options: CreateAuthProviderOptions,
): AuthProvider {
  const base = {
    dbPath: options.dbPath,
    jwtSecret: options.jwtSecret,
    jwtExpiresInSeconds: options.jwtExpiresInSeconds,
  };

  if (options.authProvider === "cas" && options.casMock) {
    return new MockCasAuthProvider(base);
  }

  if (options.authProvider === "cas" && !options.casMock) {
    return new CasAuthProvider({
      ...base,
      casServerUrl: options.casServerUrl ?? "",
    });
  }

  throw new Error(
    "AUTH_PROVIDER=local register-only path not implemented in Phase 7",
  );
}
