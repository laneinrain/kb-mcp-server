# Milestones: kb-mcp-server

## v1.4 Qwen Rerank Search

**Shipped:** 2026-07-16  
**Timeline:** 2026-07-16  
**Phases:** 13–15 | **Plans:** 7

### Delivered

Two-stage search retrieval: Chroma vector recall (`RERANK_CANDIDATES` default 30) followed by CherryIn Qwen3 rerank (`qwen/qwen3-reranker-0.6b`). Applies to REST `POST /api/v1/search` and MCP `search_knowledge` via shared `SearchService`. Graceful fallback to vector-only when rerank disabled or API unavailable.

### Key Accomplishments

1. **RerankClient** — CherryIn `/v1/rerank`, Cohere/Jina response mapping, 429 retry
2. **Search pipeline** — recall → ACL filter → rerank → topK; full chunk text for rerank
3. **Config** — `RERANK_ENABLED`, `RERANK_CANDIDATES`, `RERANK_MODEL` env vars
4. **Docs** — README 检索与 Rerank section, `.env.example` updates
5. **Resolves v1.0 deferral** — RETR-02 cross-encoder reranking

### Stats

| Metric | Value |
|--------|-------|
| v1.4 requirements | 12/12 shipped |
| Resolves v1.0 deferral | RETR-02 reranking |
| Git range | v1.3 → feat(phase-15) |

### Archives

- [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)
- [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

### Known Gaps

- Hybrid BM25 deferred (RETR-01)
- Web settings rerank toggle deferred
- Rerank evaluation harness not built
- Per-user MCP auth deferred (PLAT-04)
- CONF-03 bearer auth manual UAT still not run (carried from v1.0)

---
*Milestone completed via `/gsd-complete-milestone`*

## v1.3 Mock CAS Admin Console

**Shipped:** 2026-07-07  
**Timeline:** 2026-07-07  
**Phases:** 10–12 | **Plans:** 9

### Delivered

When `CAS_MOCK=true`, a complete mock-mode user administration backend: self-service registration with bcrypt, built-in admin account (工号 `00000` / `admin123`), admin REST APIs for account directory and cross-user document management, and a 简体中文 Web admin console. Production CAS path (`CAS_MOCK=false`) unchanged — admin features disabled.

### Key Accomplishments

1. **Mock local auth** — `local` users with bcrypt, `role` column, JWT `role` claim, admin bootstrap on startup
2. **Register API** — `POST /api/v1/auth/register` gated to mock mode; duplicate employeeId rejected
3. **Admin REST** — `/api/v1/admin/*` for user directory and cross-user document list/upload/delete
4. **Web console** — Register page (WEB-02), admin **用户管理** tab with per-user document panel
5. **RBAC** — Non-admin JWT gets 403 on admin routes; regular user document routes unchanged

### Stats

| Metric | Value |
|--------|-------|
| v1.3 requirements | 16/16 shipped |
| Resolves v1.2 deferral | WEB-02 register page |
| Git range | v1.2 → feat(phase-12) |

### Archives

- [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- [v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)

### Known Gaps

- Per-user MCP auth deferred (PLAT-04)
- Production `CasAuthProvider` not implemented
- Admin disabled when `CAS_MOCK=false`
- User account delete/disable not implemented
- CONF-03 bearer auth manual UAT still not run (carried from v1.0)

---
*Milestone completed via `/gsd-complete-milestone`*

## v1.2 Multi-User Auth & Hash Upload

**Shipped:** 2026-07-05  
**Timeline:** 2026-07-05  
**Phases:** 7–9 | **Plans:** 9

### Delivered

JWT multi-user auth with swappable `@kb/auth` (Mock CAS → production CAS), per-user document isolation on REST/Web, and content-hash dedup on filename re-uploads with `created` / `unchanged` / `replaced` outcomes.

### Key Accomplishments

1. **Auth center** — `@kb/auth` with MockCasAuthProvider, employeeId JIT users, JWT login API, 简体中文 LoginPage
2. **Multi-user backend** — registry `user_id`, system legacy migration, composite JWT/API_KEY auth, scoped list/search/delete
3. **Web auth UX** — JWT-only client, logout, 401 → login redirect; legacy docs shared read-only
4. **Hash dedup** — `content_hash` column, `(user_id, filename)` lookup, skip embed on unchanged content
5. **Operator clarity** — REST 201/200 + Web 简体中文 messages + CLI outcome JSON

### Stats

| Metric | Value |
|--------|-------|
| v1.2 requirements | 17/18 shipped (WEB-02 deferred) |
| Phase 9 UAT | 8/8 pass, 1 skipped (live dedup needs USER_AUTH) |
| Git range | 109d46b → feat(phase 9) |

### Archives

- [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

### Known Gaps

- WEB-02 register page deferred (JIT login)
- Per-user MCP auth deferred (PLAT-04)
- CONF-03 bearer auth manual UAT still not run (carried from v1.0)

---
*Milestone completed via `/gsd-complete-milestone`*

## v1.1 MCP Context Tools

**Shipped:** 2026-07-05  
**Timeline:** 2026-07-05 (same day)  
**Phases:** 5–6 | **Plans:** 5

### Delivered

MCP clients can expand `search_knowledge` hits via `read_around` and `read_file` on stdio and Streamable HTTP, backed by a shared `ContextService` with admin-configurable bounds (Web 设置 tab).

### Key Accomplishments

1. **Context retrieval core** — `ChromaVectorStore.getByIds`, `ContextService.readAround`/`readFile`, symmetric ±N windows, truncation metadata, structured `ContextError`
2. **Admin configurability** — GET/PATCH settings API and Web **上下文检索** panel (window/char limits live in SQLite)
3. **MCP read tools** — `read_around` + `read_file` on shared `buildMcpServer()` factory; snake_case MCP inputs; search-hit example in tool description
4. **Transport parity** — stdio + HTTP expose identical three-tool retrieval surface (`search_knowledge`, `read_around`, `read_file`)
5. **UAT** — `pnpm uat:read-around` passes search → read_around on live stack

### Stats

| Metric | Value |
|--------|-------|
| v1.1 requirements | 7/7 |
| Phase 5 UAT | Approved 2026-07-05 |
| Phase 6 UAT | PASS 2026-07-05 |
| Git range | feat(05-01) → feat(06-02) |

### Archives

- [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

### Known Gaps

- REST read endpoints (API-06) deferred to future milestone
- CONF-03 bearer auth still not manually UAT-tested (carried from v1.0)

---
*Milestone completed via `/gsd-complete-milestone`*

## v1.0 Initial Release

**Shipped:** 2026-07-05  
**Timeline:** 2026-06-29 → 2026-07-05 (7 days)  
**Phases:** 4 | **Plans:** 13

### Delivered

A self-hosted knowledge-base scaffold: ingest txt/markdown/text-layer PDF into local Chroma via CherryIn embeddings; semantic search through MCP (stdio + Streamable HTTP), REST API, web admin, and CLI — with optional bearer auth and production static serve.

### Key Accomplishments

1. **Ingestion pipeline** — Monorepo (pnpm + Turborepo), Zod config, Chroma sidecar, parsers, IngestionService with delete-then-upsert, CherryIn `qwen/qwen3-embedding-8b` embeddings
2. **REST backend** — Fastify API for document upload/list/delete and test search via shared SearchService; Swagger docs; health endpoints
3. **MCP retrieval** — `search_knowledge` tool over stdio and Streamable HTTP; retrieval-only, bounded responses, stderr-only stdio logging
4. **Admin surfaces** — Vite/React web admin (简体中文), Commander CLI, optional bearer auth on `/api/v1`, static SPA serve from backend
5. **UAT hardening** — Monorepo-root path resolution for SQLite/data, CLI `INIT_CWD` restore, original filename on upload, ID copy column in web UI

### Stats

| Metric | Value |
|--------|-------|
| v1 requirements | 30/30 |
| Phase 3 UAT | 8/8 passed |
| Phase 4 UAT | 7/8 passed (1 skipped: auth) |
| Git range | init → feat(04-04) |

### Archives

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

### Known Gaps

- CONF-03 bearer auth not manually UAT-tested (implementation + unit tests complete)

---
*Milestone completed via `/gsd-complete-milestone`*
