# kb-mcp-server

## What This Is

A TypeScript/Node knowledge-base MCP server. AI clients connect via **stdio** or **Streamable HTTP** to **semantic-search** ingested documents and **expand hits** with `read_around` / `read_file`. Ingestion and administration happen through a Fastify REST API, Vite/React web admin (简体中文), and Commander CLI. Documents in txt, markdown, and text-layer PDF are chunked, embedded via CherryIn, and stored in local Chroma for semantic retrieval.

**v1.2 adds:** JWT multi-user auth (`@kb/auth` with Mock CAS → production swap), per-user document isolation, and content-hash dedup on filename re-uploads.

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

### Active (v1.3 — Mock CAS Admin Console)

- [ ] **ADMIN-01**: Bootstrap `admin` / `admin123` when `CAS_MOCK=true`
- [ ] **AUTH-07**: Register API with bcrypt for local users (mock mode only)
- [ ] **AUTH-09**: JWT `role` claim (`admin` | `user`)
- [ ] **USER-05–09**: Admin REST — list all users, manage any user's documents
- [ ] **WEB-02**: Register page (简体中文)
- [ ] **WEB-05–08**: Admin 用户管理 tab — user list + per-user document management

### Active Milestone Scope

When `CAS_MOCK=true`: complete user admin backend — registration, hardcoded admin account, all-accounts query, cross-user document management. Disabled when `CAS_MOCK=false`.

### Out of Scope (carried forward)

- OCR / scanned PDF — text-layer PDF only
- Full OAuth/OIDC/LDAP implementation — interface + mock CAS shipped; production swap documented
- WEB-02 user registration page — **in scope v1.3** (mock mode only)
- Per-user MCP tool auth — MCP stays global corpus
- Hybrid BM25 / rerank — deferred (RETR-01/02)
- Upload/CRUD via MCP tools — ingestion remains backend/CLI/Web

## Current State (v1.3 planned 2026-07-07)

**Shipped milestones:** v1.0 (Phases 1–4) + v1.1 (Phases 5–6) + v1.2 (Phases 7–9) — 9 phases, 27 plans.

**Active milestone:** v1.3 Mock CAS Admin Console (Phases 10–12) — register, admin account, user directory, cross-user doc management (mock mode only).

**MCP tools:** `search_knowledge`, `read_around`, `read_file` — global corpus.

**Auth:** Optional `USER_AUTH_ENABLED` with JWT (Web) and `API_KEY` (CLI service ingest). Mock CAS for dev; `CAS_MOCK=false` + `CAS_SERVER_URL` for production.

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
| Mock CAS + employeeId JIT users | Company auth pattern; no register page in v1.2 | ✓ Good |
| Composite JWT + API_KEY | Web users vs CLI bulk ingest | ✓ Good (v1.2) |
| Hash on parsed text, keyed by `(user_id, filename)` | Skip redundant embeds on re-upload | ✓ Good (v1.2) |
| MCP global corpus | User isolation on REST/Web only | ✓ Good (by design) |
| Chroma local vector store | Lightweight single-machine scaffold | ✓ Good |
| Text-layer PDF only | Reduces v1 complexity | ✓ Good |

<details>
<summary>Prior milestone context (v1.0–v1.1)</summary>

- ContextService shared by MCP + backend SQLite settings (v1.1)
- DATA_DIR/SQLITE_PATH resolve to monorepo root
- Optional single API key bearer (v1.0)
- Streamable HTTP over legacy SSE

</details>

---
*Last updated: 2026-07-07 — v1.3 milestone planned*
