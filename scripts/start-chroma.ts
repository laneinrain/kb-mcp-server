/**
 * Start Chroma sidecar. On Windows x64 the npm `chroma` CLI is ARM64-only;
 * use the Python CLI from `pip install chromadb` (not node_modules/.bin/chroma).
 */
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function needsPythonChroma(): boolean {
  return os.platform() === "win32" && os.arch() !== "arm64";
}

function dataPath(): string {
  return process.env.CHROMA_DATA_PATH ?? "./data/chroma";
}

function resolvePythonChromaCli(): string {
  if (process.env.CHROMA_PYTHON_CLI) {
    return process.env.CHROMA_PYTHON_CLI;
  }

  try {
    const scriptsDir = execSync(
      'python -c "import sysconfig; print(sysconfig.get_path(\'scripts\'))"',
      { encoding: "utf8", cwd: projectRoot },
    ).trim();
    const exe = path.join(
      scriptsDir,
      process.platform === "win32" ? "chroma.exe" : "chroma",
    );
    if (existsSync(exe)) {
      return exe;
    }
  } catch {
    // fall through
  }

  console.error(
    "[start-chroma] Python chroma.exe not found. Run: pnpm setup:chroma",
  );
  process.exit(1);
}

function spawnChroma(
  command: string,
  args: string[],
  options: { shell: boolean },
): ReturnType<typeof spawn> {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: options.shell,
  });

  child.on("error", (err) => {
    console.error(`[start-chroma] Failed to start: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  return child;
}

function main(): void {
  const pathArg = dataPath();

  if (needsPythonChroma()) {
    const chromaCli = resolvePythonChromaCli();
    console.error(
      `[start-chroma] Windows x64 — Python CLI: ${chromaCli} run --path ${pathArg}`,
    );
    spawnChroma(chromaCli, ["run", "--path", pathArg], { shell: false });
    return;
  }

  console.error(`[start-chroma] npx chroma run --path ${pathArg}`);
  spawnChroma("npx", ["chroma", "run", "--path", pathArg], {
    shell: process.platform === "win32",
  });
}

main();
