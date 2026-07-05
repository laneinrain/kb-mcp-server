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

(None — define next milestone via `/gsd-new-milestone`.)

## Current State (v1.1 shipped)

**Shipped:** v1.0 (2026-07-05) + v1.1 (2026-07-05) — 6 phases, 18 plans, 37/37 requirements across both milestones.

**MCP tools:** `search_knowledge`, `read_around`, `read_file` (retrieval-only, shared factory on stdio + HTTP).

**Next milestone candidates:** hybrid BM25/rerank (RETR-01/02), multi-collection (PLAT-01), REST read parity (API-06).

### Out of Scope

- OCR / scanned PDF support — text-layer PDF only
- Multi-tenant or production-grade auth — single API key only
- Upload/CRUD via MCP tools — ingestion is backend/CLI/Web only
- Hosted/managed vector DB — local Chroma for scaffold simplicity
- Hybrid BM25 / rerank — deferred beyond v1.1 (see RETR-01/02 in archived requirements)

## Context

- **Stack:** pnpm + Turborepo monorepo; packages `@kb/config`, `@kb/core`; apps `@kb/backend`, `@kb/mcp-server`, `@kb/web`, `@kb/cli`
- **Ports:** Chroma 8000, Backend 3000 (+ SPA when `SERVE_WEB=true`), Web dev 5173, MCP HTTP 3100
- **Dev:** `pnpm dev` starts full stack; `pnpm uat:read-around` validates search → expand workflow
- **UAT note:** Bearer auth (CONF-03) implemented but not manually UAT-tested

## Constraints

- **Tech stack**: TypeScript/Node — aligns with MCP SDK ecosystem
- **Transport**: MCP stdio and Streamable HTTP entrypoints
- **Embedding model**: `qwen/qwen3-embedding-8b` via CherryIn API — not swappable without explicit config change in v1
- **Document formats**: txt, markdown, text-layer PDF only in v1
- **Security**: API keys in `.env` only; optional backend API key gate via env flag
- **Deployment**: Local-first scaffold; no cloud infra assumptions

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 after v1.1 milestone shipped*
