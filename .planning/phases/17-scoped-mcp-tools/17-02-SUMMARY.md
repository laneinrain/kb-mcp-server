# Phase 17 Plan 02 Summary: Scoped MCP Tools

**Completed:** 2026-07-17  
**Status:** Done

## Delivered

- `getToolAllowedDocumentIds()` — user mode only; missing ALS → undefined
- `search_knowledge` / `read_around` / `read_file` pass ACL into core services
- server tests with `runWithMcpCallerContext` for user ACL

## Tests

`pnpm --filter @kb/mcp-server test -- server` — pass
