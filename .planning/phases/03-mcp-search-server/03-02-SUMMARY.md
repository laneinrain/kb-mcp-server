---
phase: 03-mcp-search-server
plan: 02
subsystem: mcp
tags: [stdio, mcp, cursor, stderr]

requires: [03-01]
provides:
  - stdio MCP entrypoint via StdioServerTransport
  - kb-mcp-server bin pointing to dist/stdio.js
  - stderr-only logger (logInfo, logError)
affects: [03-03]

tech-stack:
  added: []
  patterns: [stderr-only logging for stdio JSON-RPC channel]

key-files:
  created:
    - apps/mcp-server/src/logger.ts
    - apps/mcp-server/src/stdio.ts
    - apps/mcp-server/src/stdio.test.ts
  modified:
    - apps/mcp-server/package.json
    - apps/mcp-server/tsconfig.json

key-decisions:
  - "dev:stdio script for Cursor MCP spawn without build"
  - "tsconfig noEmit false so bin resolves to compiled dist/stdio.js"

requirements-completed: [MCP-01]

duration: 15min
completed: 2026-06-29
---

# Phase 3 Plan 02: stdio Transport Summary

**stdio entrypoint and kb-mcp-server bin for local MCP clients**

## Accomplishments

- Added `stdio.ts` connecting `createMcpServices()` → `buildMcpServer()` → `StdioServerTransport`
- Added stderr-only `logger.ts`; no console.log in stdio chain (D-30)
- Configured `kb-mcp-server` bin → `./dist/stdio.js` and `dev:stdio` script
- 4 stdout pollution guard tests passing

## Verification

- `pnpm --filter @kb/mcp-server test` — 14 tests pass
- `pnpm --filter @kb/mcp-server build` — emits dist/stdio.js

## Cursor MCP config

```json
{ "command": "pnpm", "args": ["--filter", "@kb/mcp-server", "dev:stdio"] }
```
