# Retrospective: kb-mcp-server

Living document — append a section per shipped milestone.

## Milestone: v1.5 — MCP User Isolation

**Shipped:** 2026-07-17  
**Phases:** 3 | **Plans:** 9

### What Was Built

- Shared `resolveBearerToken` + `McpAuthResolver` + AsyncLocalStorage context (Phase 16)
- Tool ACL via `getToolAllowedDocumentIds` + `ContextService.allowedDocumentIds` (Phase 17)
- `MCP_AUTH_REQUIRED`, README Cursor auth docs, two-user isolation tests (Phase 18)

### What Worked

- Reusing REST JWT/`API_KEY` composite auth avoided a second credential system
- ALS kept `buildMcpServer` signature stable across HTTP and stdio
- `document_not_found` for ACL deny matched REST 404 semantics without new error codes
- Escape hatch `MCP_AUTH_REQUIRED=false` preserved single-tenant MCP while REST stays multi-user

### What Was Inefficient

- `MCP_AUTH_REQUIRED` required updating many `makeConfig()` test fixtures across `@kb/core`
- stdio remains single-user per process — multi-session isolation only on HTTP

### Patterns Established

- Transport auth → ALS `McpCallerContext` → tool reads ACL helper
- Effective gate: `USER_AUTH_ENABLED && MCP_AUTH_REQUIRED`
- ContextService ACL mirrors SearchService optional `ReadonlySet`

### Key Lessons

- MCP Streamable HTTP is not legacy SSE; auth belongs on every HTTP method including session GET
- Missing ALS store should mean global (tests), not throw — keeps InMemory unit tests simple

---

## Milestone: v1.4 — Qwen Rerank Search

**Shipped:** 2026-07-16  
**Phases:** 3 | **Plans:** 7

### What Was Built

- `RerankClient` for CherryIn `qwen/qwen3-reranker-0.6b` (Phase 13)
- `SearchService` two-stage recall → ACL → rerank pipeline (Phase 14)
- Env config + README + `.env.example` (Phase 15)

### What Worked

- Reusing CherryIn credentials avoided new API key management
- `SearchService.create()` wiring gave REST + MCP rerank for free
- Fallback to vector order kept search resilient when rerank API unavailable
- Injectable `fetch` in RerankClient simplified unit testing

### What Was Inefficient

- Phase 14 pulled env config forward from Phase 15 plan — minor plan overlap
- No offline rerank evaluation harness — quality improvement not quantified

### Patterns Established

- Two-stage retrieve-then-rerank in `SearchService`
- ACL filter between recall and rerank (not after)
- `score` semantics switch: rerank relevance vs vector cosine

### Key Lessons

- Chroma has no built-in rerank — application-layer two-stage is the right integration point
- Rerank on full chunk text matters; snippet truncation is display-only

---

## Milestone: v1.3 — Mock CAS Admin Console

**Shipped:** 2026-07-07  
**Phases:** 3 | **Plans:** 9

### What Was Built

- Mock local auth with bcrypt, admin bootstrap (`00000`/`admin123`), register API (Phase 10)
- Admin REST for user directory and cross-user document CRUD (Phase 11)
- Register page + admin 用户管理 Web console (Phase 12)

### What Worked

- `CAS_MOCK` gate kept production swap path clean — admin features simply absent when disabled
- JWT `role` claim avoided extra round-trip for Web admin tab gating
- Reusing UploadPanel/DocumentTable with custom API props reduced UI duplication
- `createAdminRouteOpts()` mirrored existing composite JWT/API_KEY pattern

### What Was Inefficient

- Admin employee ID changed mid-planning (`admin` → `00000`) — required plan/doc updates before execution
- Phase 11/12 plans consolidated at execution time (single summaries vs per-plan files)

### Patterns Established

- `role` column + JWT claim for lightweight RBAC
- Admin routes namespaced under `/api/v1/admin/*`
- Shared `document-upload.ts` helper for user and admin upload paths

### Key Lessons

- Scaffold admin credentials must be documented with explicit security warnings
- Mock-mode-only features should fail closed (404/403) when `CAS_MOCK=false`, not partially work

---

## Milestone: v1.2 — Multi-User Auth & Hash Upload

**Shipped:** 2026-07-05  
**Phases:** 3 | **Plans:** 9

### What Was Built

- `@kb/auth` with MockCasAuthProvider and JWT login (Phase 7)
- Per-user document scoping + composite JWT/API_KEY auth (Phase 8)
- Content-hash dedup with created/unchanged/replaced outcomes (Phase 9)

### What Worked

- Swappable auth module kept backend routes stable
- Phase 8 DATA_DIR ingest fix unblocked Web uploads before Phase 9 dedup
- Integration tests (multi-user, dedup) caught auth edge cases without live stack

### What Was Inefficient

- Path-based document IDs had to be replaced mid-milestone for Web uploads
- Live UAT for dedup blocked when USER_AUTH disabled in default `.env`

### Patterns Established

- Registry migrations via idempotent `runRegistryMigrations()`
- `outcome` field pattern for idempotent operator-facing APIs
- System user for legacy document sharing under JWT isolation

### Key Lessons

- Dedup authority must not depend on temp upload paths
- Defer register page (WEB-02) when JIT login matches org auth model

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Theme |
|-----------|--------|-------|-------|
| v1.0 | 4 | 13 | Platform + MCP search |
| v1.1 | 2 | 5 | Context expansion tools |
| v1.2 | 3 | 9 | Multi-user + hash dedup |
| v1.3 | 3 | 9 | Mock admin console + register |
| v1.4 | 3 | 7 | Qwen rerank two-stage search |
