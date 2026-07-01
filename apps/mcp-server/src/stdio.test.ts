import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { logError, logInfo } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stdioSource = readFileSync(join(__dirname, "stdio.ts"), "utf8");
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
) as { bin?: Record<string, string>; scripts?: Record<string, string> };

describe("stdio entrypoint", () => {
  it("stdio.ts contains no console.log", () => {
    expect(stdioSource).not.toMatch(/console\.log/);
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
