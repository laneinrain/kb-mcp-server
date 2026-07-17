# Phase 16 Summary: MCP Request Identity

**Completed:** 2026-07-16  
**Plans:** 3/3  
**Requirements:** PLAT-04 (auth layer), PLAT-05, PLAT-06, PLAT-07, PLAT-08, PLAT-09

## What Shipped

MCP transports now resolve caller identity before tool execution:

1. **Shared `resolveBearerToken`** in `@kb/auth` (JWT → user, API_KEY → service, auth off → none)
2. **`McpAuthResolver`** builds `McpCallerContext` with `allowedDocumentIds` for user mode
3. **HTTP `/mcp`** validates Bearer on every request; context via `AsyncLocalStorage`
4. **stdio** binds `MCP_USER_TOKEN` at startup; exits if missing when user auth enabled

## Not Yet Wired

Phase 17 must pass `getMcpCallerContext().allowedDocumentIds` into `SearchService` / `ContextService`. Auth context is available but tools still search the global corpus.

## Verification

```
pnpm --filter @kb/auth test
pnpm --filter @kb/mcp-server test   # 33 passed
```
