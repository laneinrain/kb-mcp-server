# kb-mcp-server

## What This Is

A TypeScript/Node knowledge-base MCP server scaffold. AI clients connect via **stdio** or **Streamable HTTP** to **semantic-search** ingested documents and **expand hits** with `read_around` / `read_file`. Ingestion and administration happen through a Fastify REST API, Vite/React web admin (简体中文), and Commander CLI. Documents in txt, markdown, and text-layer PDF are chunked, embedded via CherryIn, and stored in local Chroma for semantic retrieval.

Built for developers who want a self-hosted knowledge base that Cursor and other MCP clients can query and expand context without handling upload pipelines in the MCP layer itself.

## Core Value

An MCP client can reliably **semantic-search** ingested documents through a stable tool interface — if search works, the scaffold succeeds. Context expansion (`read_around`, `read_file`) extends search without changing the retrieval algorithm.

## Requirements

### Validated

- ✓ MCP server exposes `search_knowledge` over stdio and Streamable HTTP — v1.0 Phase 3
- ✓ MCP server exposes `read_around` and `read_file` over stdio and Streamable HTTP — v1.1 Phase 6
- ✓ Context retrieval reads from same Chroma/registry as search with bounded responses — v1.1 Phase 5
- ✓ Admin-configurable context limits via Web 设置 tab — v1.1 Phase 5
- ✓ Backend ingests txt, markdown, and text-layer PDF into a vector knowledge base — v1.0 Phase 1
- ✓ Embeddings via `qwen/qwen3-embedding-8b` through CherryIn OpenAI-compatible API — v1.0 Phase 1
- ✓ Local vector storage (Chroma) with single default collection; APIs designed for future multi-collection support — v1.0 Phase 1
- ✓ Backend provides REST API, web admin (upload, list docs, test search), and CLI for ingestion — v1.0 Phases 2 & 4
- ✓ Optional API key auth for backend when enabled via environment variable; default localhost dev mode without auth — v1.0 Phase 4
- ✓ Secrets (API keys) loaded from environment / `.env`, never committed to git — v1.0 Phase 1

### Active

**Milestone v1.2 — Multi-User Auth & Hash Upload**

- [ ] Independent auth center module with swappable `AuthProvider` for production IdP replacement — Phase 7
- [ ] User registration and login (API + 简体中文 Web UI) — Phases 7–8
- [ ] User-scoped document ownership; list/upload/delete/search isolated per user — Phase 8
- [ ] Same-filename upload with content-hash check: identical hash → return existing; different hash → replace vectors — Phase 9

## Current Milestone: v1.2 Multi-User Auth & Hash Upload

**Goal:** Replace single shared API key with real multi-user accounts and make uploads idempotent per filename via content hashing.

**Shipped baseline:** v1.0 (Phases 1–4) + v1.1 (Phases 5–6) — 6 phases, 18 plans, 37/37 requirements.

**MCP tools (unchanged in v1.2 scope):** `search_knowledge`, `read_around`, `read_file` — global corpus; per-user MCP auth deferred.

### Out of Scope (v1.2)

- OCR / scanned PDF support — text-layer PDF only
- Full OAuth/OIDC/LDAP implementation — v1.2 ships local auth + `AuthProvider` interface only
- Email verification, password reset, admin user-management UI
- Per-user MCP tool auth or user-scoped MCP search
- Upload/CRUD via MCP tools — ingestion remains backend/CLI/Web
- Hosted/managed vector DB — local Chroma
- Hybrid BM25 / rerank — deferred (RETR-01/02)

## Context

- **Stack:** pnpm + Turborepo monorepo; packages `@kb/config`, `@kb/core`; apps `@kb/backend`, `@kb/mcp-server`, `@kb/web`, `@kb/cli`; **new:** `@kb/auth` auth center module (v1.2)
- **Ports:** Chroma 8000, Backend 3000 (+ SPA when `SERVE_WEB=true`), Web dev 5173, MCP HTTP 3100
- **Dev:** `pnpm dev` starts full stack; `pnpm uat:read-around` validates search → expand workflow
- **Auth today:** optional single `API_KEY` bearer — v1.2 adds JWT user sessions alongside migration path

## Constraints

- **Tech stack**: TypeScript/Node — aligns with MCP SDK ecosystem
- **Transport**: MCP stdio and Streamable HTTP entrypoints
- **Embedding model**: `qwen/qwen3-embedding-8b` via CherryIn API — not swappable without explicit config change in v1
- **Document formats**: txt, markdown, text-layer PDF only in v1
- **Security**: API keys in `.env` only; v1.2 adds password hashing and JWT for user sessions
- **Deployment**: Local-first scaffold; auth module designed for swap to external IdP in production

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MCP retrieval-only; ingestion via backend | Keeps MCP tools simple and fast; upload is admin workflow | ✓ Good |
| ContextService shared by MCP + backend SQLite settings | Operator tuning without redeploy | ✓ Good (v1.1) |
| read_around inline search-hit example in tool desc | Agents discover search→expand workflow | ✓ Good (v1.1) |
| Chroma local vector store | Lightweight, persistent, good fit for single-machine scaffold | ✓ Good |
| Single collection v1, multi-collection-ready APIs | Ship fast without painting into a corner | ✓ Good |
| TypeScript/Node over Python | User preference; MCP SDK parity | ✓ Good |
| Text-layer PDF only (no OCR) | Reduces v1 complexity and dependency surface | ✓ Good |
| Optional API key auth via env | Safe local dev default; easy hardening when needed | ✓ Good (UAT skipped) |
| Backend: REST + Web admin + CLI | User wants all three admin surfaces | ✓ Good |
| Streamable HTTP over legacy SSE | MCP SDK 1.29 standard transport | ✓ Good |
| DATA_DIR/SQLITE_PATH resolve to monorepo root | Prevents CLI/Web corpus split when cwd differs | ✓ Good |
| **v1.2:** `@kb/auth` as independent module | User requirement: swap auth center in production without rewriting backend | Pending |
| **v1.2:** Hash on parsed text, keyed by `(user_id, filename)` | Same filename re-upload: skip if unchanged, replace if content differs | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 — v1.2 milestone started*
