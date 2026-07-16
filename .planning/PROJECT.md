# kb-mcp-server

## What This Is

A TypeScript/Node knowledge-base MCP server. AI clients connect via **stdio** or **Streamable HTTP** to **semantic-search** ingested documents and **expand hits** with `read_around` / `read_file`. Ingestion and administration happen through a Fastify REST API, Vite/React web admin (简体中文), and Commander CLI. Documents in txt, markdown, and text-layer PDF are chunked, embedded via CherryIn, and stored in local Chroma for semantic retrieval.

**v1.4 adds:** Two-stage search with Qwen3 rerank (`qwen/qwen3-reranker-0.6b` via CherryIn) — recall 30 candidates, rerank to top-k.

## Core Value

An MCP client can reliably **semantic-search** ingested documents through a stable tool interface — if search works, the scaffold succeeds. Context expansion (`read_around`, `read_file`) extends search without changing the retrieval algorithm.

## Requirements

### Validated

- ✓ MCP server exposes `search_knowledge`, `read_around`, `read_file` — v1.0–v1.1
- ✓ Context retrieval with admin-configurable bounds — v1.1
- ✓ Backend ingests txt, markdown, text-layer PDF into Chroma via CherryIn — v1.0
- ✓ REST API, web admin, CLI for ingestion — v1.0
- ✓ Optional API key auth — v1.0
- ✓ `@kb/auth` module with MockCasAuthProvider and JWT login — v1.2 Phase 7
- ✓ Per-user document isolation (JWT + composite API_KEY service path) — v1.2 Phase 8
- ✓ Content-hash dedup: created / unchanged / replaced outcomes — v1.2 Phase 9
- ✓ Mock local auth with bcrypt + admin bootstrap (`00000`/`admin123`) — v1.3 Phase 10
- ✓ Register API + JWT `role` claim — v1.3 Phase 10
- ✓ Admin REST: user directory + cross-user document management — v1.3 Phase 11
- ✓ Register page + admin 用户管理 Web console — v1.3 Phase 12

### Active (v1.4 — Qwen Rerank Search)

- [ ] **RETR-02–05**: `RerankClient` — CherryIn `/v1/rerank`, model `qwen/qwen3-reranker-0.6b`
- [ ] **RETR-06–10**: `SearchService` two-stage recall → ACL → rerank → topK with fallback
- [ ] **RETR-11–13**: Env config (`RERANK_ENABLED`, `RERANK_CANDIDATES`) + docs

### Active Milestone Scope

Add cross-encoder reranking to search via CherryIn (same API key). Vector recall `RERANK_CANDIDATES` (default 30), rerank to final `topK`. Applies to REST and MCP. Graceful fallback when disabled or API unavailable.

### Out of Scope (carried forward)

- OCR / scanned PDF — text-layer PDF only
- Full OAuth/OIDC/LDAP implementation — interface + mock CAS shipped; production swap documented
- Per-user MCP tool auth — MCP stays global corpus (PLAT-04)
- Hybrid BM25 — deferred (RETR-01); rerank in scope v1.4
- Upload/CRUD via MCP tools — ingestion remains backend/CLI/Web
- User account delete/disable — admin list + doc management only
- Admin features when `CAS_MOCK=false` — production uses company CAS

## Current State (2026-07-16)

**Shipped milestones:** v1.0 (Phases 1–4) + v1.1 (Phases 5–6) + v1.2 (Phases 7–9) + v1.3 (Phases 10–12) — 12 phases, 36 plans.

**Active milestone:** v1.4 Qwen Rerank Search — **PLANNED** (Phases 13–15, 0/12 requirements).

**Search:** Vector recall via `qwen/qwen3-embedding-8b`; v1.4 adds rerank via `qwen/qwen3-reranker-0.6b`.

**MCP tools:** `search_knowledge`, `read_around`, `read_file` — global corpus.

**Auth:** Optional `USER_AUTH_ENABLED` with JWT (Web) and `API_KEY` (CLI service ingest). Mock CAS for dev with local registration and admin console; `CAS_MOCK=false` + `CAS_SERVER_URL` for production.

**Upload dedup:** `(user_id, filename)` key; SHA-256 of normalized parsed text; outcomes surfaced in REST/Web/CLI.

## Context

- **Stack:** pnpm + Turborepo; `@kb/config`, `@kb/core`, `@kb/auth`; apps `@kb/backend`, `@kb/mcp-server`, `@kb/web`, `@kb/cli`
- **Ports:** Chroma 8000, Backend 3000, Web dev 5173, MCP HTTP 3100
- **Dev:** `pnpm dev` — full stack; enable auth via `.env` (`USER_AUTH_ENABLED`, `JWT_SECRET`, `CAS_MOCK`)

## Constraints

- TypeScript/Node, MCP stdio + Streamable HTTP
- Embedding: `qwen/qwen3-embedding-8b` via CherryIn
- Document formats: txt, markdown, text-layer PDF
- Secrets in `.env` only
- Local-first deployment

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MCP retrieval-only; ingestion via backend | Simple MCP tools | ✓ Good |
| `@kb/auth` swappable module | Production CAS swap without Web changes | ✓ Good (v1.2) |
| Mock CAS + employeeId JIT users | Company auth pattern | ✓ Good |
| Composite JWT + API_KEY | Web users vs CLI bulk ingest | ✓ Good (v1.2) |
| Hash on parsed text, keyed by `(user_id, filename)` | Skip redundant embeds on re-upload | ✓ Good (v1.2) |
| MCP global corpus | User isolation on REST/Web only | ✓ Good (by design) |
| Admin only in `CAS_MOCK=true` | Scaffold operator console | ✓ Good (v1.3) |
| `role` column + JWT claim | Simple RBAC without roles table | ✓ Good (v1.3) |
| Two-stage recall + rerank | Precision boost without changing ingest | Planned (v1.4) |
| Chroma local vector store | Lightweight single-machine scaffold | ✓ Good |
| Text-layer PDF only | Reduces v1 complexity | ✓ Good |

<details>
<summary>Prior milestone context (v1.0–v1.2)</summary>

- ContextService shared by MCP + backend SQLite settings (v1.1)
- DATA_DIR/SQLITE_PATH resolve to monorepo root
- Optional single API key bearer (v1.0)
- Streamable HTTP over legacy SSE
- WEB-02 register page deferred in v1.2, shipped in v1.3

</details>

---
*Last updated: 2026-07-16 — v1.4 milestone planned*
