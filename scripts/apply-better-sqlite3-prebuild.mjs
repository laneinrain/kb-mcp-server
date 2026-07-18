/**
 * Apply vendored better-sqlite3 native prebuilds (no GitHub download).
 *
 * Expects archives under vendor/better-sqlite3/ named:
 *   better-sqlite3-v{version}-node-v{abi}-{platform}-{arch}.tar.gz
 *
 * Matches lockfile version 12.11.1 and Node 24 (ABI 137) for linux-x64 / win32-x64.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const vendorDir = join(root, "vendor", "better-sqlite3");
const VERSION = "12.11.1";

function resolveBetterSqlite3Root() {
  const require = createRequire(import.meta.url);
  const searchPaths = [
    join(root, "packages", "core"),
    join(root, "packages", "auth"),
    root,
  ];
  try {
    return dirname(
      require.resolve("better-sqlite3/package.json", { paths: searchPaths }),
    );
  } catch {
    return null;
  }
}

function pickArchive() {
  const abi = process.versions.modules; // e.g. "137" for Node 24
  const platform = process.platform; // win32 | linux | darwin
  const arch = process.arch; // x64 | arm64
  const exact = `better-sqlite3-v${VERSION}-node-v${abi}-${platform}-${arch}.tar.gz`;
  const exactPath = join(vendorDir, exact);
  if (existsSync(exactPath)) {
    return { file: exactPath, label: exact };
  }

  if (!existsSync(vendorDir)) {
    throw new Error(
      `Missing vendor dir ${vendorDir}. Add prebuild archives for offline install.`,
    );
  }

  const candidates = readdirSync(vendorDir).filter(
    (name) =>
      name.startsWith(`better-sqlite3-v${VERSION}-`) &&
      name.includes(`-${platform}-${arch}.tar.gz`),
  );
  if (candidates.length === 0) {
    throw new Error(
      `No vendored better-sqlite3 prebuild for ${platform}-${arch} (Node ABI ${abi}). ` +
        `Expected e.g. ${exact} under vendor/better-sqlite3/.`,
    );
  }

  // Prefer matching ABI; otherwise first candidate (warn).
  const abiMatch = candidates.find((name) => name.includes(`-node-v${abi}-`));
  const chosen = abiMatch ?? candidates[0];
  if (!abiMatch) {
    console.warn(
      `[better-sqlite3] No exact ABI ${abi} archive; using ${chosen}`,
    );
  }
  return { file: join(vendorDir, chosen), label: chosen };
}

function apply() {
  const pkgRoot = resolveBetterSqlite3Root();
  if (!pkgRoot) {
    console.warn(
      "[better-sqlite3] package not installed yet — skip apply (run after pnpm install)",
    );
    return;
  }

  const { file, label } = pickArchive();
  const destNode = join(pkgRoot, "build", "Release", "better_sqlite3.node");
  mkdirSync(join(pkgRoot, "build", "Release"), { recursive: true });

  // Archives contain build/Release/better_sqlite3.node
  execFileSync("tar", ["-xzf", file, "-C", pkgRoot], { stdio: "inherit" });

  if (!existsSync(destNode)) {
    throw new Error(
      `Extracted ${label} but missing ${destNode}`,
    );
  }

  console.log(
    `[better-sqlite3] Applied vendored prebuild ${label} → ${destNode}`,
  );
}

try {
  apply();
} catch (error) {
  console.error(
    `[better-sqlite3] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
