import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMPLOYEE_ID,
  SYSTEM_EMPLOYEE_ID,
} from "./constants.js";
import { AuthConflictError, AuthValidationError } from "./errors.js";
import { hashPassword } from "./password.js";
import { MockCasAuthProvider } from "./mock-cas-auth-provider.js";
import { UserStore, openAuthDatabase } from "./user-store.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";

describe("jwt", () => {
  it("sign/verify roundtrip includes role=admin", async () => {
    const token = await signAccessToken({
      userId: "user-1",
      employeeId: ADMIN_EMPLOYEE_ID,
      role: "admin",
      secret: JWT_SECRET,
      expiresInSeconds: 3600,
    });
    const payload = await verifyAccessToken(token, JWT_SECRET);
    expect(payload.role).toBe("admin");
    expect(payload.employeeId).toBe(ADMIN_EMPLOYEE_ID);
  });

  it("defaults missing role claim to user", async () => {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { SignJWT } = await import("jose");
    const token = await new SignJWT({ employeeId: "12345" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("3600s")
      .sign(secret);

    const payload = await verifyAccessToken(token, JWT_SECRET);
    expect(payload.role).toBe("user");
  });
});

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
    expect(result.user.role).toBe("user");
  });

  it("admin 00000 logs in with admin123", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-auth-test-"));
    const dbPath = join(tempDir, "auth.db");
    const db = openAuthDatabase(dbPath);
    const store = new UserStore(db);
    const hash = await hashPassword(ADMIN_DEFAULT_PASSWORD);
    store.ensureAdminUser(hash);
    db.close();

    provider = new MockCasAuthProvider({
      dbPath,
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    const result = await provider.login({
      employeeId: ADMIN_EMPLOYEE_ID,
      password: ADMIN_DEFAULT_PASSWORD,
    });

    expect(result.user.role).toBe("admin");
    expect(result.user.employeeId).toBe(ADMIN_EMPLOYEE_ID);
  });

  it("rejects wrong admin password", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-auth-test-"));
    const dbPath = join(tempDir, "auth.db");
    const db = openAuthDatabase(dbPath);
    const store = new UserStore(db);
    store.ensureAdminUser(await hashPassword(ADMIN_DEFAULT_PASSWORD));
    db.close();

    provider = new MockCasAuthProvider({
      dbPath,
      jwtSecret: JWT_SECRET,
      jwtExpiresInSeconds: 3600,
    });

    await expect(
      provider.login({
        employeeId: ADMIN_EMPLOYEE_ID,
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("register and login local user with bcrypt", async () => {
    const provider = createProvider();
    await provider.register({
      employeeId: "54321",
      password: "password123",
    });

    const result = await provider.login({
      employeeId: "54321",
      password: "password123",
    });
    expect(result.user.authSource).toBe("local");

    await expect(
      provider.login({
        employeeId: "54321",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("register rejects reserved employee id", async () => {
    const provider = createProvider();
    await expect(
      provider.register({
        employeeId: ADMIN_EMPLOYEE_ID,
        password: "password123",
      }),
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("register rejects duplicate employee id", async () => {
    const provider = createProvider();
    await provider.register({
      employeeId: "54321",
      password: "password123",
    });
    await expect(
      provider.register({
        employeeId: "54321",
        password: "password123",
      }),
    ).rejects.toBeInstanceOf(AuthConflictError);
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

  it("validateAccessToken roundtrips with role", async () => {
    const provider = createProvider();
    const { tokens, user } = await provider.login({
      employeeId: "87654321",
      password: "secret",
    });

    const validated = await provider.validateAccessToken(tokens.accessToken);
    expect(validated.id).toBe(user.id);
    expect(validated.employeeId).toBe("87654321");
    expect(validated.role).toBe("user");
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
