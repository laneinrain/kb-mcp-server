# Phase 16: MCP Request Identity - Context

**Gathered:** 2026-07-16  
**Status:** Ready for execution

<domain>
## Phase Boundary

Resolve **caller identity** for MCP transports and make **`McpCallerContext`** available before tool execution. HTTP validates Bearer JWT (or service `API_KEY`) on every `/mcp` request; stdio binds a single user via **`MCP_USER_TOKEN`** at process startup.

**In scope:** PLAT-04 (auth layer only), PLAT-05, PLAT-06, PLAT-07, PLAT-08, PLAT-09

**Out of scope (Phase 17+):** Passing `allowedDocumentIds` into tool handlers; `ContextService` ACL; `buildMcpServer` tool scoping; `MCP_AUTH_REQUIRED` env (Phase 18); README / `.env.example` docs (Phase 18)

**Unchanged this phase:** Tool search/read behavior (still global corpus until Phase 17 wires context into handlers)
</domain>

<decisions>
## Implementation Decisions

### Shared Bearer Resolution
- **D-01:** Extract **`resolveBearerToken()`** to `@kb/auth` — single source for JWT → user, `API_KEY` → service, `USER_AUTH_ENABLED=false` → none
- **D-02:** Refactor **`apps/backend/src/auth.ts`** `createProtectedRouteOpts` to call `resolveBearerToken` (no behavior change)
- **D-03:** `McpAuthResolver` in `@kb/mcp-server` wraps `resolveBearerToken` + registry ACL prep (`allowedDocumentIds` computed but not consumed by tools until Phase 17)

### McpCallerContext
- **D-04:** Type in `apps/mcp-server/src/auth/types.ts`:

  ```typescript
  export type McpAuthMode = "user" | "service" | "global";

  export interface McpCallerContext {
    authMode: McpAuthMode;
    authUser?: AuthUser;
    /** undefined = no ACL filter (global corpus) */
    allowedDocumentIds?: ReadonlySet<string>;
  }
  ```

- **D-05:** `authMode: "global"` when `USER_AUTH_ENABLED=false` — no token required; `allowedDocumentIds` undefined
- **D-06:** `authMode: "user"` — `allowedDocumentIds` = `registry.listDocumentsForUser(userId, systemUserId).map(d => d.id)` as `Set`
- **D-07:** `authMode: "service"` — `allowedDocumentIds` undefined (global corpus, parity REST `authMode=service`)

### Errors & Fail Closed
- **D-08:** `McpAuthError` with `statusCode` default 401; message mirrors REST: `"Missing Bearer token"` / `"Invalid or expired token"`
- **D-09:** HTTP: auth failure **before** `transport.handleRequest` — return JSON-RPC-shaped 401 or plain 401 JSON `{ error, message }` consistent with REST
- **D-10:** stdio: missing/invalid token when `USER_AUTH_ENABLED=true` → `logError` + `process.exit(1)` at startup (fail fast)

### HTTP Transport (PLAT-05)
- **D-11:** Validate Bearer on **every** `POST /mcp` when `USER_AUTH_ENABLED=true` (initialize, tools/call, notifications)
- **D-12:** `GET /mcp` and `DELETE /mcp` also require Bearer when user auth active (session continuity)
- **D-13:** Use **`AsyncLocalStorage<McpCallerContext>`** (`mcp-request-context.ts`) — wrap each `transport.handleRequest` in `storage.run(context, ...)` so Phase 17 tools can call `getMcpCallerContext()`
- **D-14:** Session map stores `{ transport, lastContext }` — context refreshed each authenticated request (token rotation safe)

### stdio Transport (PLAT-06)
- **D-15:** Read **`process.env.MCP_USER_TOKEN`** at startup (not added to `@kb/config` until Phase 18 — raw env read in stdio.ts)
- **D-16:** When `USER_AUTH_ENABLED=true`, `MCP_USER_TOKEN` required; resolve once → store in module-level `stdioCallerContext` + seed ALS default via getter
- **D-17:** When `USER_AUTH_ENABLED=false`, ignore `MCP_USER_TOKEN`; context = global

### Service Factory (16-03)
- **D-18:** Extend **`createMcpServices()`** mirroring `apps/backend/src/services.ts`: `authProvider`, `systemUserId`, `registry`, `McpAuthResolver` instance
- **D-19:** Add **`@kb/auth`** dependency to `@kb/mcp-server` package.json
- **D-20:** `McpServices` interface gains: `authProvider`, `registry`, `systemUserId`, `authResolver`

### Claude's Discretion
- Exact 401 response body for MCP HTTP (plain JSON vs JSON-RPC error wrapper)
- Whether to export `getMcpCallerContext()` from package index or internal only
- Mock auth fixtures in mcp-server tests (in-memory auth DB like backend tests)
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — PLAT-04–09
- `.planning/milestones/v1.5-ROADMAP.md` — Phase 16 plans
- `apps/backend/src/auth.ts` — composite JWT + API_KEY pattern (D-01 refactor source)
- `apps/backend/src/services.ts` — authProvider + systemUserId bootstrap
- `apps/backend/src/routes/search.ts` — `allowedDocumentIds` resolution pattern
- `apps/mcp-server/src/http.ts` — Streamable HTTP session lifecycle
- `apps/mcp-server/src/stdio.ts` — stdio entrypoint
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAuthProvider`, `UserStore.ensureSystemUser`, `AuthProvider.validateAccessToken` — `@kb/auth`
- `DocumentRegistry.listDocumentsForUser(userId, systemUserId)` — `@kb/core`
- `createProtectedRouteOpts` — mirror semantics in MCP resolver
- `http.test.ts` — supertest session init helpers

### Integration Points (Phase 17, not this phase)
- `buildMcpServer` will read `getMcpCallerContext()` and pass `allowedDocumentIds` to SearchService / ContextService
- `server.ts` tool handlers unchanged in Phase 16 except optional no-op getter wiring

### Gaps
- `@kb/mcp-server` has no `@kb/auth` dependency today
- `createMcpServices()` returns only `searchService` + `contextService`
- HTTP `/mcp` has zero auth middleware
</code_context>
