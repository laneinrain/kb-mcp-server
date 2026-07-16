import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { findMonorepoRoot, loadConfig } from "./env.js";
describe("findMonorepoRoot", () => {
  it("finds repo root from packages/config", () => {
    const configDir = path.dirname(fileURLToPath(import.meta.url));
    const root = findMonorepoRoot(configDir);
    expect(existsSync(path.join(root, "pnpm-workspace.yaml"))).toBe(true);
    expect(existsSync(path.join(root, "apps", "cli"))).toBe(true);
  });
});

describe("loadConfig", () => {
  it("returns typed config when required vars are set", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    delete process.env.AUTH_ENABLED;
    delete process.env.API_KEY;
    delete process.env.USER_AUTH_ENABLED;
    delete process.env.JWT_SECRET;
    const config = loadConfig();
    expect(config.CHUNK_SIZE).toBe(1024);
    expect(config.CHUNK_OVERLAP).toBe(154);
    expect(config.READ_AROUND_WINDOW_DEFAULT).toBe(1);
    expect(config.READ_AROUND_WINDOW_MAX).toBe(3);
    expect(config.READ_AROUND_MAX_CHARS).toBe(32000);
    expect(config.READ_FILE_MAX_CHUNKS).toBe(50);
    expect(config.READ_FILE_MAX_CHARS).toBe(64000);
    expect(config.CHERRYIN_BASE_URL).toBe("https://open.cherryin.cc/v1");
    expect(config.RERANK_ENABLED).toBe(true);
    expect(config.RERANK_CANDIDATES).toBe(30);
    expect(config.RERANK_MODEL).toBe("qwen/qwen3-reranker-0.6b");
    expect(config.AUTH_ENABLED).toBe(false);
    expect(config.API_KEY).toBeUndefined();
    expect(path.isAbsolute(config.SQLITE_PATH)).toBe(true);
    expect(path.isAbsolute(config.DATA_DIR)).toBe(true);
  });

  it("succeeds without API_KEY when AUTH_ENABLED is false or omitted", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    process.env.AUTH_ENABLED = "false";
    delete process.env.API_KEY;
    const config = loadConfig();
    expect(config.AUTH_ENABLED).toBe(false);
    expect(config.API_KEY).toBeUndefined();
  });

  it("includes AUTH_ENABLED and API_KEY when auth is enabled", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    process.env.AUTH_ENABLED = "true";
    process.env.API_KEY = "secret-api-key";
    const config = loadConfig();
    expect(config.AUTH_ENABLED).toBe(true);
    expect(config.API_KEY).toBe("secret-api-key");
  });

  it("exits when AUTH_ENABLED is true without API_KEY", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.CHERRYIN_API_KEY = "test-key";
    process.env.AUTH_ENABLED = "true";
    delete process.env.API_KEY;

    expect(() => loadConfig()).toThrow("process.exit:1");
    const errorOutput = errorSpy.mock.calls.flat().join(" ");
    expect(errorOutput).toContain("API_KEY");

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("succeeds without JWT_SECRET when USER_AUTH_ENABLED is false", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    delete process.env.AUTH_ENABLED;
    delete process.env.API_KEY;
    delete process.env.USER_AUTH_ENABLED;
    delete process.env.JWT_SECRET;
    const config = loadConfig();
    expect(config.USER_AUTH_ENABLED).toBe(false);
    expect(config.JWT_SECRET).toBeUndefined();
    expect(config.CAS_MOCK).toBe(true);
    expect(path.isAbsolute(config.AUTH_SQLITE_PATH)).toBe(true);
  });

  it("includes user auth fields when USER_AUTH_ENABLED is true", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    delete process.env.AUTH_ENABLED;
    delete process.env.API_KEY;
    process.env.USER_AUTH_ENABLED = "true";
    process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
    const config = loadConfig();
    expect(config.USER_AUTH_ENABLED).toBe(true);
    expect(config.JWT_SECRET).toContain("test-jwt-secret");
    expect(config.AUTH_PROVIDER).toBe("cas");
  });

  it("enables mock user auth by default in development", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    process.env.CHERRYIN_API_KEY = "test-key";
    delete process.env.AUTH_ENABLED;
    delete process.env.API_KEY;
    delete process.env.USER_AUTH_ENABLED;
    delete process.env.JWT_SECRET;

    const config = loadConfig();
    expect(config.USER_AUTH_ENABLED).toBe(true);
    expect(config.JWT_SECRET).toContain("dev-only-jwt-secret");
    expect(config.CAS_MOCK).toBe(true);

    process.env.NODE_ENV = prevNodeEnv;
  });

  it("exits when USER_AUTH_ENABLED is true without JWT_SECRET", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.CHERRYIN_API_KEY = "test-key";
    delete process.env.AUTH_ENABLED;
    delete process.env.API_KEY;
    process.env.USER_AUTH_ENABLED = "true";
    delete process.env.JWT_SECRET;

    expect(() => loadConfig()).toThrow("process.exit:1");
    const errorOutput = errorSpy.mock.calls.flat().join(" ");
    expect(errorOutput).toContain("JWT_SECRET");

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
