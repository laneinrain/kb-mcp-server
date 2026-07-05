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

**Goal:** Independent `@kb/auth` with **MockCasAuthProvider**, 工号 login API, and 简体中文 login page; production swaps to company CAS without Web changes.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-06, **WEB-01** (login page only)

**Success criteria:**
1. `@kb/auth` exports `AuthProvider`, `MockCasAuthProvider`, JWT helpers, `createJwtPreHandler`
2. `POST /api/v1/auth/login` with `employeeId` + password → mock CAS success → JWT + JIT user
3. Web login page (工号 + 密码) stores `kb_access_token` and enters admin
4. README documents Mock → real **统一 CAS** swap (`CAS_MOCK`, `CAS_SERVER_URL`)

**Plans:** 3 plans in 3 waves

**Wave 1** *(foundation)*
- [ ] 07-01: `@kb/auth` + MockCasAuthProvider + employeeId store + config (AUTH-01, AUTH-02)

**Wave 2** *(blocked on Wave 1)*
- [ ] 07-02: Login API + README (AUTH-03, AUTH-06)

**Wave 3** *(blocked on Wave 2)*
- [ ] 07-03: Web LoginPage + JWT client (WEB-01)

---

### Phase 8: Multi-User Backend & Web Auth

**Goal:** JWT-protected API, per-user document isolation, logout, optional register.

**Requirements:** AUTH-04, AUTH-05, USER-01, USER-02, USER-03, USER-04, WEB-02, WEB-03 (full), WEB-04

**Success criteria:**
1. `/api/v1` document and search routes require valid user JWT when user auth enabled
2. Documents and Chroma metadata scoped by `user_id`; migration assigns legacy docs to default user
3. Logout clears token; unauthenticated redirect (complete WEB-03); optional register page (WEB-02)
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
| 7. Auth Center Module | v1.2 | 0/3 | Planned | — |
| 8. Multi-User Backend & Web Auth | v1.2 | 0/? | Not started | — |
| 9. Filename Content-Hash Dedup | v1.2 | 0/? | Not started | — |

---
*Last updated: 2026-07-05 — v1.2 milestone roadmap created*
