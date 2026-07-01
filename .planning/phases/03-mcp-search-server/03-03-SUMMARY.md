---
phase: 03-mcp-search-server
plan: 03
subsystem: mcp
tags: [streamable-http, express, config, supertest]

requires: [03-02]
provides:
  - Streamable HTTP MCP at POST /mcp on MCP_HTTP_HOST:MCP_HTTP_PORT
  - MCP_HTTP_HOST and MCP_HTTP_PORT in @kb/config
  - createMcpHttpApp() testable factory
  - Root pnpm dev starts backend + MCP HTTP
affects: [phase-4-admin]

tech-stack:
  added: [express@^5, supertest]
  patterns: [session map with onsessioninitialized, Accept header for Streamable HTTP]

key-files:
  created:
    - apps/mcp-server/src/http.ts
    - apps/mcp-server/src/http.test.ts
  modified:
    - packages/config/src/env.ts
    - .env.example
    - package.json
    - packages/core/src/embeddings/embedding-client.test.ts
    - packages/core/src/registry/settings-store.test.ts
    - packages/core/src/vector-store/chroma-store.test.ts

key-decisions:
  - "Default bind 127.0.0.1:3100 separate from backend 3000"
  - "Same buildMcpServer() on HTTP session init as stdio"

requirements-completed: [MCP-02]

duration: 20min
completed: 2026-06-29
checkpoint: pending
---

# Phase 3 Plan 03: Streamable HTTP Summary

**Streamable HTTP transport at POST /mcp with config and route tests**

## Accomplishments

- Added `MCP_HTTP_HOST` / `MCP_HTTP_PORT` to `@kb/config` and `.env.example`
- Implemented `http.ts` with Express + `StreamableHTTPServerTransport` session management
- Exported `createMcpHttpApp()` for supertest; 4 HTTP route tests passing
- Extended root `pnpm dev` to run `@kb/mcp-server` alongside `@kb/backend`

## Verification

- `pnpm --filter @kb/config build` — success
- `pnpm --filter @kb/mcp-server test` — 14 tests pass
- `pnpm --filter @kb/mcp-server build` — success

## Human checkpoint (pending)

Operator must verify live stdio + HTTP search against ingested corpus. Reply **approved** when done, or describe issues.

### How to verify

1. Ensure `.env` has valid `CHERRYIN_API_KEY`; ingest: `curl.exe -F "file=@scripts/fixtures/sample.txt" http://127.0.0.1:3000/api/v1/documents`
2. **stdio:** Configure Cursor MCP with `pnpm --filter @kb/mcp-server dev:stdio`; invoke `search_knowledge`
3. **HTTP:** Run `pnpm --filter @kb/mcp-server dev` → `http://127.0.0.1:3100/mcp`
4. Compare MCP results with REST: `POST http://127.0.0.1:3000/api/v1/search` with same query
5. List tools → confirm only `search_knowledge`
6. Confirm stdio startup has no stdout (stderr only)
