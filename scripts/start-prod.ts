/**
 * Production stack: build → Chroma + Backend (API + static Web on :3000) + MCP HTTP.
 *
 * Sets NODE_ENV=production so Backend serves apps/web/dist (see static.ts).
 *
 * Usage:
 *   pnpm start:prod
 *   pnpm start:prod -- --skip-build   # skip pnpm build when artifacts already exist
 */
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const skipBuild = process.argv.includes("--skip-build");

const PROD_BUILD =
  "pnpm --filter @kb/config build && pnpm --filter @kb/core build && pnpm --filter @kb/auth build && pnpm --filter @kb/web build && pnpm --filter @kb/backend build && pnpm --filter @kb/mcp-server build";

function main(): void {
  process.env.NODE_ENV = "production";

  if (!skipBuild) {
    console.error("[start:prod] Building production artifacts …");
    execSync(PROD_BUILD, { cwd: projectRoot, stdio: "inherit", shell: true });
  }

  const webIndex = path.join(projectRoot, "apps/web/dist/index.html");
  if (!existsSync(webIndex)) {
    console.error(
      "[start:prod] Missing apps/web/dist/index.html — run pnpm build or drop --skip-build",
    );
    process.exit(1);
  }

  console.error(
    "[start:prod] NODE_ENV=production — Web SPA at http://127.0.0.1:3000 (with API)",
  );

  // Single shell command (matches package.json "dev") — avoids Windows argv/shell quoting bugs.
  // concurrently is vendored (file:vendor/concurrently/…) for private-network installs.
  const runCmd =
    'pnpm exec concurrently -k -n chroma,backend,mcp -c blue,green,magenta ' +
    '"tsx scripts/start-chroma.ts" ' +
    '"pnpm wait:chroma && pnpm --filter @kb/backend start" ' +
    '"pnpm wait:chroma && pnpm --filter @kb/mcp-server start"';

  const child = spawn(runCmd, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
