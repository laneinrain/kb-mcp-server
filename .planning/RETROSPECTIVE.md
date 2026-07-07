# Retrospective: kb-mcp-server

Living document — append a section per shipped milestone.

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
