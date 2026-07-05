# Roadmap: kb-mcp-server

**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## Milestones

- ✅ **v1.0 Initial Release** — Phases 1–4 (shipped 2026-07-05)
- ✅ **v1.1 MCP Context Tools** — Phases 5–6 (shipped 2026-07-05)
- 🚧 **v1.2 Multi-User Auth & Hash Upload** — Phases 7–9 (planning)

See [MILESTONES.md](MILESTONES.md), [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md), and [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md).

## Phases

<details>
<summary>✅ v1.0 Initial Release (Phases 1–4) — SHIPPED 2026-07-05</summary>

- [x] Phase 1: Platform Foundation & Ingestion (3/3 plans)
- [x] Phase 2: REST Backend & Search (3/3 plans)
- [x] Phase 3: MCP Search Server (3/3 plans)
- [x] Phase 4: Admin Surfaces & Security (4/4 plans)

</details>

<details>
<summary>✅ v1.1 MCP Context Tools (Phases 5–6) — SHIPPED 2026-07-05</summary>

- [x] Phase 5: Context Retrieval Core (3/3 plans)
- [x] Phase 6: MCP Read Tools (2/2 plans)

</details>

### Phase 7: Auth Center Module

**Goal:** Standalone auth package with swappable provider and user registration/login API.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-06

**Success criteria:**
1. `@kb/auth` exports `AuthProvider`, `LocalAuthProvider`, JWT helpers, and Fastify auth middleware factory
2. Users table in SQLite; passwords hashed; register + login REST routes return JWT
3. Unit tests cover register, login, invalid credentials, token validation
4. README documents how to replace `LocalAuthProvider` with external IdP

**Plans:** TBD via `/gsd-plan-phase 7`

---

### Phase 8: Multi-User Backend & Web Auth

**Goal:** JWT-protected API, per-user document isolation, and 简体中文 login/register UI.

**Requirements:** AUTH-04, AUTH-05, USER-01, USER-02, USER-03, USER-04, WEB-01, WEB-02, WEB-03, WEB-04

**Success criteria:**
1. `/api/v1` document and search routes require valid user JWT when auth enabled
2. Documents and Chroma metadata scoped by `user_id`; migration assigns legacy docs to default user
3. Web login/register pages work end-to-end; protected routes redirect when logged out
4. Integration tests: user A cannot read/delete user B documents

**Plans:** TBD via `/gsd-plan-phase 8`

---

### Phase 9: Filename Content-Hash Dedup

**Goal:** Same-filename uploads skip re-embedding when content unchanged; replace when content differs.

**Requirements:** INGE-10, INGE-11, INGE-12, INGE-13

**Success criteria:**
1. `content_hash` stored; unique lookup on `(user_id, filename)`
2. Re-upload identical content returns `unchanged` with existing `document_id` (no Chroma upsert)
3. Re-upload changed content returns `replaced`; old vectors removed
4. Tests cover created / unchanged / replaced paths

**Plans:** TBD via `/gsd-plan-phase 9`

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–4 | v1.0 | 13/13 | Complete | 2026-07-05 |
| 5. Context Retrieval Core | v1.1 | 3/3 | Complete | 2026-07-05 |
| 6. MCP Read Tools | v1.1 | 2/2 | Complete | 2026-07-05 |
| 7. Auth Center Module | v1.2 | 0/? | Not started | — |
| 8. Multi-User Backend & Web Auth | v1.2 | 0/? | Not started | — |
| 9. Filename Content-Hash Dedup | v1.2 | 0/? | Not started | — |

---
*Last updated: 2026-07-05 — v1.2 milestone roadmap created*
