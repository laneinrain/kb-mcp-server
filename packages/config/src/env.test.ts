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
    const config = loadConfig();
    expect(config.CHUNK_SIZE).toBe(1024);
    expect(config.CHUNK_OVERLAP).toBe(154);
    expect(config.CHERRYIN_BASE_URL).toBe("https://open.cherryin.cc/v1");
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
});
