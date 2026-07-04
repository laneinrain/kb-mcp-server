---
phase: 04-admin-surfaces-security
plan: 02
subsystem: cli
tags: [commander, rest-client, ingest, dual-path-auth]

requires:
  - phase: 04-01
    provides: AUTH_ENABLED, API_KEY, Bearer auth on /api/v1/*
provides:
  - "@kb/cli Commander CLI (kb ingest | list | delete)"
  - REST api-client with optional Bearer header
  - Dual-path ingest (REST when auth on, direct @kb/core when off)
  - Root pnpm ingest alias to @kb/cli
affects: [04-04-e2e]

tech-stack:
  added: ["commander@15.0.0", "@kb/cli workspace package"]
  patterns:
    - "createApiClient + FormData upload for REST ingest"
    - "verbose per-file stderr progress for directory ingest"
    - "table-formatted list output per discuss decisions"

key-files:
  created:
    - apps/cli/package.json
    - apps/cli/src/index.ts
    - apps/cli/src/api-client.ts
    - apps/cli/src/commands/ingest.ts
    - apps/cli/src/commands/list.ts
    - apps/cli/src/commands/delete.ts
    - apps/cli/src/api-client.test.ts
    - apps/cli/src/commands/ingest.test.ts
    - apps/cli/src/commands/delete.test.ts
  modified:
    - package.json
    - scripts/ingest.ts

requirements:
  - CLI-01
  - CLI-02

---

# Phase 4 Plan 02 Summary

**Plan:** 04-02 — CLI ingest, list, delete  
**Status:** Complete  
**Date:** 2026-07-04

## Delivered

- **`@kb/cli`** with `kb` bin and subcommands `ingest`, `list`, `delete`
- **`createApiClient`**: Bearer when `AUTH_ENABLED`; list/upload/delete/search methods
- **`ingest`**: file + recursive directory walk (`.txt/.md/.markdown/.pdf`); verbose stderr progress; dual-path auth branch
- **`list`**: table output (id, filename, status, chunks, collection, updatedAt)
- **`delete`**: REST DELETE with exit 1 on not_found, 2 on other API errors
- **Root `pnpm ingest`** → `pnpm --filter @kb/cli cli -- ingest`
- **`scripts/ingest.ts`**: deprecation stub pointing to `pnpm ingest`

## Tests

`pnpm --filter @kb/cli test` — **6 passed** (api-client Bearer, ingest path selection, delete client, allowlist)

## Discuss overrides applied

- Table `list` (not JSON-only from original plan text)
- Verbose per-file ingest progress + summary line
- Both `kb` bin and `pnpm ingest` alias
- `--collection` default `default`

## Next

Wave 3 — 04-03 Web admin SPA
