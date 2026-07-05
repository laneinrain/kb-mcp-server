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
import { MockCasAuthProvider } from "@kb/auth";
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

  async function buildApp(authEnabled: boolean) {
    tempDir = mkdtempSync(join(tmpdir(), "kb-auth-route-test-"));
    authProvider = authEnabled
      ? new MockCasAuthProvider({
          dbPath: join(tempDir, "auth.db"),
          jwtSecret: JWT_SECRET,
          jwtExpiresInSeconds: 3600,
        })
      : null;

    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await registerAuthRoutes(app, { authProvider });
    return app;
  }

  it("POST login returns accessToken for valid employeeId", async () => {
    const app = await buildApp(true);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "any" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      accessToken: string;
      user: { id: string; employeeId: string };
    };
    expect(body.accessToken).toBeTruthy();
    expect(body.user.employeeId).toBe("12345678");
  });

  it("POST login rejects invalid employeeId", async () => {
    const app = await buildApp(true);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "123", password: "any" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("POST login rejects empty password", async () => {
    const app = await buildApp(true);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("repeat login returns same user id", async () => {
    const app = await buildApp(true);
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
    const app = await buildApp(false);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { employeeId: "12345678", password: "any" },
    });

    expect(response.statusCode).toBe(404);
  });
});
