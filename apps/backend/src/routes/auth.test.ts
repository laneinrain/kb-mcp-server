import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { describe, expect, it, afterEach } from "vitest";
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMPLOYEE_ID,
  MockCasAuthProvider,
  UserStore,
  hashPassword,
  openAuthDatabase,
} from "@kb/auth";
import { registerAuthRoutes } from "./auth.js";

const JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";

describe("registerAuthRoutes", () => {
  let tempDir: string;
  let authProvider: MockCasAuthProvider | null = null;

  afterEach(async () => {
    authProvider?.close();
    authProvider = null;
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore Windows cleanup races
      }
    }
  });

  async function buildApp(options: {
    authEnabled: boolean;
    casMock?: boolean;
    bootstrapAdmin?: boolean;
  }) {
    tempDir = mkdtempSync(join(tmpdir(), "kb-auth-route-test-"));
    const dbPath = join(tempDir, "auth.db");

    if (options.bootstrapAdmin) {
      const db = openAuthDatabase(dbPath);
      try {
        const store = new UserStore(db);
        store.ensureAdminUser(await hashPassword(ADMIN_DEFAULT_PASSWORD));
      } finally {
        db.close();
      }
    }

    authProvider = options.authEnabled
      ? new MockCasAuthProvider({
          dbPath,
          jwtSecret: JWT_SECRET,
          jwtExpiresInSeconds: 3600,
        })
      : null;

    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await registerAuthRoutes(app, {
      authProvider,
      casMock: options.casMock ?? true,
    });
    return app;
  }

  it("POST login returns accessToken for valid employeeId", async () => {
    const app = await buildApp({ authEnabled: true });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "any" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      accessToken: string;
      user: { id: string; employeeId: string; role: string };
    };
    expect(body.accessToken).toBeTruthy();
    expect(body.user.employeeId).toBe("12345678");
    expect(body.user.role).toBe("user");
  });

  it("POST login returns admin role for 00000/admin123", async () => {
    const app = await buildApp({ authEnabled: true, bootstrapAdmin: true });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        employeeId: ADMIN_EMPLOYEE_ID,
        password: ADMIN_DEFAULT_PASSWORD,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { user: { role: string; employeeId: string } };
    expect(body.user.employeeId).toBe(ADMIN_EMPLOYEE_ID);
    expect(body.user.role).toBe("admin");
  });

  it("POST login rejects invalid employeeId", async () => {
    const app = await buildApp({ authEnabled: true });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "123", password: "any" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("POST login rejects empty password", async () => {
    const app = await buildApp({ authEnabled: true });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("repeat login returns same user id", async () => {
    const app = await buildApp({ authEnabled: true });
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "a" },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "b" },
    });

    const firstBody = first.json() as { user: { id: string } };
    const secondBody = second.json() as { user: { id: string } };
    expect(secondBody.user.id).toBe(firstBody.user.id);
  });

  it("returns 404 when user auth disabled", async () => {
    const app = await buildApp({ authEnabled: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "any" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("POST register creates local user when casMock", async () => {
    const app = await buildApp({ authEnabled: true, casMock: true });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { employeeId: "54321", password: "password123" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      user: { employeeId: string; role: string; authSource?: string };
    };
    expect(body.user.employeeId).toBe("54321");
    expect(body.user.role).toBe("user");
  });

  it("POST register returns 409 for duplicate employeeId", async () => {
    const app = await buildApp({ authEnabled: true, casMock: true });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { employeeId: "54321", password: "password123" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { employeeId: "54321", password: "password123" },
    });

    expect(response.statusCode).toBe(409);
  });

  it("POST register returns 404 when casMock false", async () => {
    const app = await buildApp({ authEnabled: true, casMock: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { employeeId: "54321", password: "password123" },
    });

    expect(response.statusCode).toBe(404);
  });
});
