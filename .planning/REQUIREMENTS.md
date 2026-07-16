# Requirements: kb-mcp-server

**Defined:** 2026-07-16  
**Milestone:** v1.5 MCP User Isolation  
**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## Milestone Goal

Close **PLAT-04**: scope MCP tools (`search_knowledge`, `read_around`, `read_file`) to the authenticated user's document set — matching REST/Web JWT isolation semantics. HTTP clients pass Bearer tokens; stdio uses a process-scoped token for dev/single-user. Service-account `API_KEY` retains global corpus access when `USER_AUTH_ENABLED=true`.

## v1.5 Requirements

### MCP Authentication

- [~] **PLAT-04**: MCP tools respect per-user document isolation (auth layer done Phase 16; tool ACL Phase 17)
- [x] **PLAT-05**: HTTP `/mcp` validates `Authorization: Bearer <token>` on every request when user auth is active
- [x] **PLAT-06**: stdio transport reads `MCP_USER_TOKEN` env at startup to bind a single user scope (documented dev/single-user path)
- [x] **PLAT-07**: Valid `API_KEY` bearer acts as service account with global corpus access (parity with REST composite auth)
- [x] **PLAT-08**: When `USER_AUTH_ENABLED=false`, MCP retains legacy global corpus with no auth gate
- [x] **PLAT-09**: When user auth is required, missing or invalid token returns 401 (HTTP) or tool error (stdio) — fail closed

### Tool Scoping

- [ ] **PLAT-10**: `search_knowledge` passes `allowedDocumentIds` from `registry.listDocumentsForUser(userId, systemUserId)` — same set as REST `POST /api/v1/search`
- [ ] **PLAT-11**: `read_around` denies documents outside the caller's allowed set (not found / forbidden semantics)
- [ ] **PLAT-12**: `read_file` denies documents outside the caller's allowed set
- [ ] **PLAT-13**: `ContextService` accepts optional `allowedDocumentIds` on `readAround` / `readFile` (parallel to `SearchService`)

### Configuration & Documentation

- [ ] **PLAT-14**: Env config: `MCP_AUTH_REQUIRED` (default `true` when `USER_AUTH_ENABLED=true`, ignored when false)
- [ ] **PLAT-15**: README + `.env.example` document MCP auth, Cursor `mcp.json` `headers.Authorization`, and stdio `MCP_USER_TOKEN`
- [ ] **PLAT-16**: Automated tests: two users with disjoint docs — user A cannot search/read user B's documents via MCP

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-04 | 16–17 | Partial (auth done) |
| PLAT-05 | 16 | Complete |
| PLAT-06 | 16 | Complete |
| PLAT-07 | 16–17 | Complete (resolver) |
| PLAT-08 | 16–17 | Complete (resolver) |
| PLAT-09 | 16 | Complete |
| PLAT-10 | 17 | Pending |
| PLAT-11 | 17 | Pending |
| PLAT-12 | 17 | Pending |
| PLAT-13 | 17 | Pending |
| PLAT-14 | 18 | Pending |
| PLAT-15 | 18 | Pending |
| PLAT-16 | 18 | Pending |

**Coverage:** 5/13 (auth layer); tool ACL + docs remaining

## Out of Scope (v1.5)

- Hybrid BM25 + semantic fusion (RETR-01)
- Per-session multi-user stdio (one token per process only)
- OAuth/OIDC/LDAP production CAS implementation (interface exists; swap deferred)
- Upload/CRUD via MCP tools
- Web UI for MCP token management
- User account delete/disable
- Rerank evaluation harness

## Key Decisions (locked for planning)

| Decision | Rationale |
|----------|-----------|
| Reuse JWT + `API_KEY` composite auth from REST | Consistent credentials; no new token type |
| HTTP Bearer on every `/mcp` request | Cursor `mcp.json` supports `headers`; session init inherits caller identity |
| stdio `MCP_USER_TOKEN` env | stdio has no per-request headers; single-user dev path |
| Service account sees all docs | Matches REST `authMode=service` for CLI bulk ingest |
| `USER_AUTH_ENABLED=false` → global MCP | Backward compatible with v1.0–v1.4 single-tenant deploys |
| ACL in `ContextService` options | Same pattern as `SearchService.allowedDocumentIds`; shared core logic |
| Fail closed when auth required | Prevents accidental data leakage across users |

## MCP Auth Flow (target)

```
HTTP /mcp request
  → extract Authorization: Bearer <token>
  → validate JWT via AuthProvider OR match API_KEY (service)
  → resolve allowedDocumentIds from DocumentRegistry
  → tool handlers pass ACL to SearchService / ContextService

stdio process
  → read MCP_USER_TOKEN at startup (optional when USER_AUTH_ENABLED=false)
  → bind single McpCallerContext for all tool invocations
```

---

*Created: 2026-07-16 via `/gsd-new-milestone`*
