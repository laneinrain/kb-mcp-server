# Vendored better-sqlite3 prebuilds

Offline native binaries for **`better-sqlite3@12.11.1`** (matches `pnpm-lock.yaml`).

## Included

| File | Environment |
|------|-------------|
| `better-sqlite3-v12.11.1-node-v137-linux-x64.tar.gz` | Ubuntu / Linux x64, **Node 24** (ABI 137) |
| `better-sqlite3-v12.11.1-node-v137-win32-x64.tar.gz` | Windows x64, **Node 24** (ABI 137) |

Source: [WiseLibs/better-sqlite3 releases v12.11.1](https://github.com/WiseLibs/better-sqlite3/releases/tag/v12.11.1)

## How install uses them

1. `pnpm-workspace.yaml` sets `allowBuilds.better-sqlite3: false` so install scripts **do not** download from GitHub.
2. Root `postinstall` runs `scripts/apply-better-sqlite3-prebuild.mjs`, which extracts the matching archive into the installed package’s `build/Release/`.

## Updating

When bumping `better-sqlite3` or Node major (ABI changes), download the matching `node-v{ABI}-{platform}-{arch}.tar.gz` into this folder and keep the naming pattern.
