# Requirements: kb-mcp-server

**Defined:** 2026-07-05
**Milestone:** v1.2 Multi-User Auth & Hash Upload
**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## v1.2 Requirements

### Auth Center

- [ ] **AUTH-01**: `@kb/auth` package exposes an `AuthProvider` interface with a default local implementation (register, login, validate token, get user) so production can swap to OAuth/OIDC/LDAP without changing backend route handlers
- [ ] **AUTH-02**: Local auth stores users in SQLite with bcrypt/argon2 password hashing; no plaintext passwords persisted
- [ ] **AUTH-03**: Register and login REST endpoints issue signed JWT access tokens with configurable expiry
- [ ] **AUTH-04**: Backend `/api/v1` routes accept user JWT (replacing sessionStorage API key for web flows); optional legacy `API_KEY` bearer remains configurable for service-to-service / MCP-adjacent use during transition
- [ ] **AUTH-05**: Invalid, expired, or missing user token returns 401 with clear error body (consistent with existing API error shape)
- [ ] **AUTH-06**: Auth module documents swap points (`AuthProvider` contract, env vars, middleware hook) in package README

### Multi-User Documents

- [ ] **USER-01**: `documents` registry rows include `user_id`; Chroma chunk metadata includes owning `user_id`
- [ ] **USER-02**: Authenticated users can only list, upload, delete, and search their own documents
- [ ] **USER-03**: Existing pre-v1.2 documents migrate to a designated system/default user on first startup after migration (no orphaned rows)
- [ ] **USER-04**: Unauthenticated requests to protected document/search routes receive 401 (when auth enabled)

### Web Auth UI

- [ ] **WEB-01**: Login page (简体中文) accepts username/email + password and stores JWT for API calls
- [ ] **WEB-02**: Register page (简体中文) creates account and redirects to login or auto-login
- [ ] **WEB-03**: Protected admin routes redirect unauthenticated visitors to login
- [ ] **WEB-04**: Logout clears stored token and returns user to login

### Hash Dedup Upload

- [ ] **INGE-10**: System stores `content_hash` (SHA-256 of normalized parsed text, post-parse pre-chunk) on each document
- [ ] **INGE-11**: Upload with same `(user_id, filename)` and identical `content_hash` returns existing document without re-embedding (idempotent response includes prior `document_id`)
- [ ] **INGE-12**: Upload with same `(user_id, filename)` and different `content_hash` deletes prior vectors/chunks and re-ingests (replace semantics)
- [ ] **INGE-13**: Upload response indicates outcome: `created`, `unchanged`, or `replaced` for operator clarity

## Future Requirements

Deferred beyond v1.2. Tracked but not in current roadmap.

### Auth Enhancements

- **AUTH-10**: OAuth2/OIDC provider implementation behind `AuthProvider`
- **AUTH-11**: Email verification and password reset flows
- **AUTH-12**: Admin UI for user list / disable account

### Retrieval Enhancements

- **RETR-01**: Hybrid BM25 + semantic search with reciprocal rank fusion
- **RETR-02**: Cross-encoder reranking on search results

### Platform

- **PLAT-01**: Multiple named collections with collection-scoped search and ingest
- **PLAT-02**: Incremental re-index (skip unchanged files) — partially addressed by INGE-11 in v1.2
- **PLAT-03**: Async job queue for large batch ingestion
- **PLAT-04**: Per-user MCP tool auth and user-scoped MCP search

## Out of Scope

Explicitly excluded from v1.2 to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full OAuth/OIDC/LDAP provider | Interface + local auth only; external IdP is production swap, not v1.2 build |
| Email verification / password reset | Not requested; adds mail infra |
| Admin user-management UI | Not requested |
| Per-user MCP auth | MCP stays global corpus; user isolation is REST/Web/CLI |
| CLI multi-user login | CLI can continue service API key; user CLI auth deferred |
| OCR / scanned PDF | Unchanged from v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 7 | Pending |
| AUTH-02 | Phase 7 | Pending |
| AUTH-03 | Phase 7 | Pending |
| AUTH-04 | Phase 8 | Pending |
| AUTH-05 | Phase 8 | Pending |
| AUTH-06 | Phase 7 | Pending |
| USER-01 | Phase 8 | Pending |
| USER-02 | Phase 8 | Pending |
| USER-03 | Phase 8 | Pending |
| USER-04 | Phase 8 | Pending |
| WEB-01 | Phase 8 | Pending |
| WEB-02 | Phase 8 | Pending |
| WEB-03 | Phase 8 | Pending |
| WEB-04 | Phase 8 | Pending |
| INGE-10 | Phase 9 | Pending |
| INGE-11 | Phase 9 | Pending |
| INGE-12 | Phase 9 | Pending |
| INGE-13 | Phase 9 | Pending |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after v1.2 milestone scoping*
