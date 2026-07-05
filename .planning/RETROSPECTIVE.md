# Retrospective: kb-mcp-server

Living document — append a section per shipped milestone.

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
