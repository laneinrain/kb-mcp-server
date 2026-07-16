import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { McpAuthError } from "./auth/mcp-auth-resolver.js";
import { logError, logInfo } from "./logger.js";
import { resolveStdioCallerContext } from "./stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stdioSource = readFileSync(join(__dirname, "stdio.ts"), "utf8");
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as { bin?: Record<string, string>; scripts?: Record<string, string> };

describe("stdio entrypoint", () => {
  it("stdio.ts contains no console.log", () => {
    expect(stdioSource).not.toMatch(/console\.log/);
  });

  it("stdio.ts reads MCP_USER_TOKEN for user auth bootstrap", () => {
    expect(stdioSource).toMatch(/MCP_USER_TOKEN/);
    expect(stdioSource).toMatch(/authResolver/);
  });

  it("package.json bin maps kb-mcp-server to dist/stdio.js", () => {
    expect(packageJson.bin?.["kb-mcp-server"]).toBe("./dist/stdio.js");
  });

  it("package.json defines dev:stdio script", () => {
    expect(packageJson.scripts?.["dev:stdio"]).toBeDefined();
  });

  it("logger writes to stderr not stdout", () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    logInfo("info message");
    logError(new Error("fail"));

    expect(stderrWrite).toHaveBeenCalled();
    expect(stdoutWrite).not.toHaveBeenCalled();

    stderrWrite.mockRestore();
    stdoutWrite.mockRestore();
  });
});

describe("resolveStdioCallerContext", () => {
  it("returns global when USER_AUTH_ENABLED is false", async () => {
    const resolve = vi.fn();
    const ctx = await resolveStdioCallerContext(false, resolve, "ignored");
    expect(ctx).toEqual({ authMode: "global" });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolves MCP_USER_TOKEN when user auth enabled", async () => {
    const resolve = vi.fn(async () => ({
      authMode: "user" as const,
      allowedDocumentIds: new Set(["d1"]),
    }));
    const ctx = await resolveStdioCallerContext(true, resolve, "jwt-token");
    expect(resolve).toHaveBeenCalledWith("jwt-token");
    expect(ctx.authMode).toBe("user");
  });

  it("propagates McpAuthError when token missing", async () => {
    const resolve = vi.fn(async () => {
      throw new McpAuthError("Missing Bearer token");
    });
    await expect(
      resolveStdioCallerContext(true, resolve, undefined),
    ).rejects.toBeInstanceOf(McpAuthError);
  });
});
