import type { AuthProvider, AuthUser, LoginInput, LoginResult } from "./types.js";

export interface CasAuthProviderOptions {
  casServerUrl: string;
  dbPath: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
}

export class CasAuthProvider implements AuthProvider {
  constructor(_options: CasAuthProviderOptions) {
    // Real CAS client wired in production milestone.
  }

  async login(_input: LoginInput): Promise<LoginResult> {
    throw new Error(
      "Real CAS not implemented — set CAS_MOCK=true or implement CasAuthProvider",
    );
  }

  async validateAccessToken(_token: string): Promise<AuthUser> {
    throw new Error(
      "Real CAS not implemented — set CAS_MOCK=true or implement CasAuthProvider",
    );
  }

  async getUserById(_id: string): Promise<AuthUser | null> {
    throw new Error(
      "Real CAS not implemented — set CAS_MOCK=true or implement CasAuthProvider",
    );
  }
}
