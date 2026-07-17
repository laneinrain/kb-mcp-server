# Phase 17: Scoped MCP Tools - Context

**Gathered:** 2026-07-17  
**Status:** Ready for execution

<domain>
## Phase Boundary

Wire **`McpCallerContext.allowedDocumentIds`** into all three MCP tools so search and context reads enforce the same ACL as REST. Extend **`ContextService`** with optional document-set filtering.

**In scope:** PLAT-04 (complete), PLAT-07, PLAT-08, PLAT-10, PLAT-11, PLAT-12, PLAT-13

**Out of scope (Phase 18):** `MCP_AUTH_REQUIRED` env, README / `.env.example` / Cursor `mcp.json` docs, full two-user live isolation integration suite (basic unit/integration tests land here; PLAT-16 harness in Phase 18)

**Unchanged:** Auth resolution (Phase 16), ingest pipeline, REST routes, tool names/schemas
</domain>

<decisions>
## Implementation Decisions

### ContextService ACL (PLAT-13, PLAT-11, PLAT-12)
- **D-01:** Add optional `allowedDocumentIds?: ReadonlySet<string>` to `ReadAroundOptions` and `ReadFileOptions`
- **D-02:** After `registry.getDocument(documentId)` succeeds, if `allowedDocumentIds` is defined and `!allowedDocumentIds.has(documentId)` → throw `contextError("document_not_found", ...)` — **404-style, not 403** (parity with REST USER-02 / Phase 8 D-16)
- **D-03:** When `allowedDocumentIds` is `undefined`, no ACL filter (service / global / auth-off)
- **D-04:** Unknown document still returns `document_not_found` before ACL check (existing path)

### Tool ACL helper
- **D-05:** Add `getToolAllowedDocumentIds()` in `mcp-request-context.ts`:
  - No ALS store → `undefined` (global; keeps InMemoryTransport unit tests working)
  - `authMode === "user"` → `ctx.allowedDocumentIds` (may be empty Set)
  - `authMode === "service" | "global"` → `undefined`
- **D-06:** Do **not** change `buildMcpServer` signature — tools call `getToolAllowedDocumentIds()` inside handlers (Phase 16 ALS already wraps HTTP/stdio)

### search_knowledge (PLAT-10)
- **D-07:** Pass `allowedDocumentIds: getToolAllowedDocumentIds()` into `searchService.search()` options (alongside `topK`, `collection`)

### read_around / read_file (PLAT-11, PLAT-12)
- **D-08:** Pass `allowedDocumentIds` into `contextService.readAround` / `readFile` options
- **D-09:** Tool error surface unchanged — `ContextError` message returned with `isError: true`

### Service / global bypass (PLAT-07, PLAT-08)
- **D-10:** Service and global modes leave `allowedDocumentIds` undefined → full corpus (no code path that passes empty Set for service)
- **D-11:** Empty Set for user with zero visible docs is valid — search returns `[]`; read returns `document_not_found`

### Tests
- **D-12:** `context-service.test.ts` — ACL deny vs allow; undefined = no filter
- **D-13:** `server.test.ts` — with `enterMcpCallerContext({ authMode: "user", allowedDocumentIds })`, assert search/read receive ACL; service/global omit ACL
- **D-14:** Existing server tests without ALS continue to pass (D-05 missing-store → undefined)

### Claude's Discretion
- Exact error message string for ACL deny (must use `document_not_found` code)
- Whether to extract small `assertDocumentAllowed(docId, allowed?)` private helper in ContextService
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — PLAT-04, PLAT-07–08, PLAT-10–13
- `.planning/milestones/v1.5-ROADMAP.md` — Phase 17 plans
- `.planning/phases/16-mcp-request-identity/16-CONTEXT.md` — ALS + `McpCallerContext`
- `packages/core/src/search/search-service.ts` — existing `allowedDocumentIds` filter
- `packages/core/src/context/context-service.ts` — readAround / readFile
- `apps/backend/src/routes/search.ts` — REST ACL pattern
- `apps/mcp-server/src/server.ts` — tool handlers
- `apps/mcp-server/src/auth/mcp-request-context.ts` — ALS helpers
</canonical_refs>

<code_context>
## Existing Code Insights

### Ready from Phase 16
- `McpAuthResolver` already fills `allowedDocumentIds` via `listDocumentsForUser`
- HTTP: `runWithMcpCallerContext` around `handleRequest`
- stdio: `enterMcpCallerContext` before `server.connect`

### Gap
- `buildMcpServer` ignores caller context — search/read are global
- `ContextService` has no ACL option (unlike `SearchService`)

### Integration Points (Phase 18)
- End-to-end two-user MCP isolation tests with real JWT
- Operator docs for Cursor headers / `MCP_USER_TOKEN`
</code_context>
