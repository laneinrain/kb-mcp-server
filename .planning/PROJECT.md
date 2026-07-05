# kb-mcp-server

## What This Is

A TypeScript/Node knowledge-base MCP server scaffold. AI clients connect via **stdio** or **Streamable HTTP** to search a vectorized document store; ingestion and administration happen through a Fastify REST API, Vite/React web admin (简体中文), and Commander CLI. Documents in txt, markdown, and text-layer PDF are chunked, embedded via CherryIn, and stored in local Chroma for semantic retrieval.

Built for developers who want a self-hosted knowledge base that Cursor and other MCP clients can query without handling upload pipelines in the MCP layer itself.

## Core Value

An MCP client can reliably **semantic-search** ingested documents through a stable tool interface — if search works, the scaffold succeeds.

## Requirements

### Validated

- ✓ MCP server exposes `search_knowledge` over stdio and Streamable HTTP — v1.0 Phase 3
- ✓ Backend ingests txt, markdown, and text-layer PDF into a vector knowledge base — v1.0 Phase 1
- ✓ Embeddings via `qwen/qwen3-embedding-8b` through CherryIn OpenAI-compatible API — v1.0 Phase 1
- ✓ Local vector storage (Chroma) with single default collection; APIs designed for future multi-collection support — v1.0 Phase 1
- ✓ Backend provides REST API, web admin (upload, list docs, test search), and CLI for ingestion — v1.0 Phases 2 & 4
- ✓ Optional API key auth for backend when enabled via environment variable; default localhost dev mode without auth — v1.0 Phase 4
- ✓ Secrets (API keys) loaded from environment / `.env`, never committed to git — v1.0 Phase 1

### Active

(None — v1.1 requirements in `.planning/REQUIREMENTS.md`.)

## Current Milestone: v1.1 MCP Context Tools

**Goal:** Let MCP clients expand search hits into neighboring chunks or bounded full-document reads — without changing the search algorithm.

**Target features:**
- `read_around` — fetch chunks before/after a hit by `document_id` + `chunk_index`
- `read_file` — fetch ordered document content with safe size limits
- stdio + Streamable HTTP parity for new read tools
- Shared Chroma/registry path with existing `SearchService`

**Explicitly NOT in v1.1:** hybrid BM25, cross-encoder rerank, multi-collection UI

### Out of Scope

- OCR / scanned PDF support — text-layer PDF only; keeps v1 parsing simple and predictable
- Multi-tenant or production-grade auth — v1 is a personal/dev scaffold; single API key only
- Upload/CRUD via MCP tools — ingestion is backend/CLI/Web only; MCP is retrieval-focused
- Hosted/managed vector DB (Milvus, Qdrant cloud, pgvector) — local Chroma for scaffold simplicity

## Context

- **Shipped v1.0** (2026-07-05): 4 phases, 13 plans, 30/30 requirements
- **Stack:** pnpm + Turborepo monorepo; packages `@kb/config`, `@kb/core`; apps `@kb/backend`, `@kb/mcp-server`, `@kb/web`, `@kb/cli`
- **Ports:** Chroma 8000, Backend 3000 (+ SPA when `SERVE_WEB=true`), Web dev 5173, MCP HTTP 3100
- **Dev:** `pnpm dev` starts full stack; daily web UI at http://127.0.0.1:5173
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

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 after v1.0 milestone*
