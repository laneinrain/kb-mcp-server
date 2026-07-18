# Vendored better-sqlite3 prebuilds

Offline native binaries for **`better-sqlite3@12.11.1`** (locked in `pnpm-lock.yaml`).

**Why:** Private-network installs cannot reach GitHub Releases. npm packages go through a registry proxy; this folder covers the **native** prebuild only.

**Project context (2026-07-18):** Milestone **v1.5 MCP User Isolation** is shipped (`v1.5` / PR #8). This vendor support ships on branch `fix/dev-prebuild-auth` (with `pnpm dev` also prebuilding `@kb/auth`). Engines: **Node `>=24 <25`** (ABI **137**).

## Included

| File | Size (approx.) | Environment |
|------|----------------|-------------|
| `better-sqlite3-v12.11.1-node-v137-linux-x64.tar.gz` | ~1.0 MB | Ubuntu / Linux x64, Node 24 (ABI 137) |
| `better-sqlite3-v12.11.1-node-v137-win32-x64.tar.gz` | ~1.0 MB | Windows x64, Node 24 (ABI 137) |

Upstream: [WiseLibs/better-sqlite3 v12.11.1](https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.11.1)  
(Note: this release uses **`node-v137`** assets for Node 24 — not `napi-v3`.)

## Who depends on it

| Package | Role |
|---------|------|
| `@kb/core` | Document registry / settings SQLite |
| `@kb/auth` | User auth SQLite (`auth.db`) |

Indirectly used by Backend, MCP, and CLI via those packages.

## Install flow

1. `pnpm-workspace.yaml` → `allowBuilds.better-sqlite3: false` (no GitHub `prebuild-install`).
2. Root `package.json` → `"postinstall": "node scripts/apply-better-sqlite3-prebuild.mjs"`.
3. Script picks the archive for `process.platform` + `process.arch` + `process.versions.modules`, then extracts into the installed package:

```text
node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

Archives stay in `vendor/`; only the `.node` file is unpacked under `node_modules`.

## Updating

When bumping `better-sqlite3` or the Node major (ABI changes), download matching:

```text
better-sqlite3-v{VERSION}-node-v{ABI}-{platform}-{arch}.tar.gz
```

into this folder, keep names exact, and re-run `pnpm install` (or `node scripts/apply-better-sqlite3-prebuild.mjs`).
