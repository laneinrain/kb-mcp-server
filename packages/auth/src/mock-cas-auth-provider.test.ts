import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuthValidationError } from "./errors.js";
import { MockCasAuthProvider } from "./mock-cas-auth-provider.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";

describe("MockCasAuthProvider", () => {
  let tempDir: string;
  let provider: MockCasAuthProvider | null = null;

  afterEach(() => {
    provider?.close();
    provider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows may keep SQLite handles briefly
      }
    }
  });

  function createProvider(): MockCasAuthProvider {
    tempDir = mkdtempSync(join(tmpdir(), "kb-auth-test-"));
    provider = new MockCasAuthProvider({
      dbPath: join(tempDir, "auth.db"),
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });
    return provider;
  }

  it("login succeeds for valid employeeId and password", async () => {
    const provider = createProvider();
    const result = await provider.login({
      employeeId: "12345678",
      password: "any-password",
    });

    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.tokenType).toBe("Bearer");
    expect(result.user.employeeId).toBe("12345678");
  });

  it("rejects invalid employeeId", async () => {
    const provider = createProvider();
    await expect(
      provider.login({ employeeId: "123", password: "x" }),
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("rejects empty password", async () => {
    const provider = createProvider();
    await expect(
      provider.login({ employeeId: "12345678", password: "   " }),
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("rejects system employee id login", async () => {
    const provider = createProvider();
    await expect(
      provider.login({ employeeId: "00000000", password: "secret" }),
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("validateAccessToken roundtrips", async () => {
    const provider = createProvider();
    const { tokens, user } = await provider.login({
      employeeId: "87654321",
      password: "secret",
    });

    const validated = await provider.validateAccessToken(tokens.accessToken);
    expect(validated.id).toBe(user.id);
    expect(validated.employeeId).toBe("87654321");
  });

  it("JIT upsert returns same user id on repeat login", async () => {
    const provider = createProvider();
    const first = await provider.login({
      employeeId: "12345678",
      password: "a",
    });
    const second = await provider.login({
      employeeId: "12345678",
      password: "b",
    });
    expect(second.user.id).toBe(first.user.id);
  });
});
