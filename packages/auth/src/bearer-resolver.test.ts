import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BearerAuthError,
  resolveBearerToken,
} from "./bearer-resolver.js";
import { MockCasAuthProvider } from "./mock-cas-auth-provider.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
const API_KEY = "test-service-api-key";

describe("resolveBearerToken", () => {
  let tempDir: string;
  let provider: MockCasAuthProvider | null = null;

  afterEach(() => {
    provider?.close();
    provider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  function createProvider(): MockCasAuthProvider {
    tempDir = mkdtempSync(join(tmpdir(), "kb-bearer-test-"));
    provider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });
    return provider;
  }

  it("returns none when USER_AUTH_ENABLED is false", async () => {
    const result = await resolveBearerToken("anything", {
      userAuthEnabled: false,
      authEnabled: false,
      authProvider: null,
    });
    expect(result).toEqual({ mode: "none" });
  });

  it("throws Missing Bearer token when token absent", async () => {
    await expect(
      resolveBearerToken(undefined, {
        userAuthEnabled: true,
        authEnabled: false,
        authProvider: createProvider(),
      }),
    ).rejects.toMatchObject({
      name: "BearerAuthError",
      message: "Missing Bearer token",
      statusCode: 401,
    });
  });

  it("returns user mode for valid JWT", async () => {
    const authProvider = createProvider();
    const login = await authProvider.login({
      employeeId: "12345678",
      password: "any-password",
    });

    const result = await resolveBearerToken(login.tokens.accessToken, {
      userAuthEnabled: true,
      authEnabled: false,
      authProvider,
    });

    expect(result.mode).toBe("user");
    expect(result.user?.employeeId).toBe("12345678");
  });

  it("returns service mode for matching API_KEY", async () => {
    const result = await resolveBearerToken(API_KEY, {
      userAuthEnabled: true,
      authEnabled: true,
      apiKey: API_KEY,
      authProvider: createProvider(),
    });

    expect(result).toEqual({ mode: "service" });
  });

  it("throws Invalid or expired token for bad JWT", async () => {
    await expect(
      resolveBearerToken("not-a-valid-jwt", {
        userAuthEnabled: true,
        authEnabled: false,
        authProvider: createProvider(),
      }),
    ).rejects.toBeInstanceOf(BearerAuthError);

    await expect(
      resolveBearerToken("not-a-valid-jwt", {
        userAuthEnabled: true,
        authEnabled: false,
        authProvider: createProvider(),
      }),
    ).rejects.toMatchObject({
      message: "Invalid or expired token",
      statusCode: 401,
    });
  });

  it("prefers JWT over API_KEY when both would match shape", async () => {
    const authProvider = createProvider();
    const login = await authProvider.login({
      employeeId: "87654321",
      password: "pw",
    });

    const result = await resolveBearerToken(login.tokens.accessToken, {
      userAuthEnabled: true,
      authEnabled: true,
      apiKey: API_KEY,
      authProvider,
    });

    expect(result.mode).toBe("user");
  });
});
