# kb-mcp-server

## What This Is

A TypeScript/Node scaffold for a knowledge-base MCP server. AI clients connect via **stdio** or **SSE** to search a vectorized document store; ingestion and administration happen through a separate backend (REST API, lightweight web UI, and CLI). Documents in txt, markdown, and text-layer PDF are chunked, embedded, and stored locally for semantic retrieval.

Built for developers who want a self-hosted knowledge base that Cursor and other MCP clients can query without handling upload pipelines in the MCP layer itself.

## Core Value

An MCP client can reliably **semantic-search** ingested documents through a stable tool interface — if search works, the scaffold succeeds.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] MCP server exposes search-focused tools (e.g. `search_knowledge`) over stdio and SSE transports
- [ ] Backend ingests txt, markdown, and text-layer PDF into a vector knowledge base
- [ ] Embeddings via `qwen/qwen3-embedding-8b` through CherryIn OpenAI-compatible API (`https://open.cherryin.cc`)
- [ ] Local vector storage (Chroma) with single default collection; APIs designed for future multi-collection support
- [ ] Backend provides REST API, simple web admin (upload, list docs, test search), and CLI for ingestion
- [ ] Optional API key auth for backend when enabled via environment variable; default localhost dev mode without auth
- [ ] Secrets (API keys) loaded from environment / `.env`, never committed to git

### Out of Scope

- OCR / scanned PDF support — text-layer PDF only; keeps v1 parsing simple and predictable
- Multi-tenant or production-grade auth — v1 is a personal/dev scaffold
- Upload/CRUD via MCP tools — ingestion is backend/CLI/Web only; MCP is retrieval-focused
- Hosted/managed vector DB (Milvus, Qdrant cloud, pgvector) — local Chroma for scaffold simplicity

## Context

- Greenfield project in an empty repository (`kb-mcp-server`)
- User operates in a Cursor/MCP-centric workflow and wants both transport modes for flexibility (local stdio vs remote SSE)
- Embedding provider is CherryIn with Qwen3 embedding model; configuration is externalized
- Prior decision: start with one vector collection but shape interfaces so multiple collections can be added without breaking changes

## Constraints

- **Tech stack**: TypeScript/Node — aligns with MCP SDK ecosystem and user's explicit choice over Python
- **Transport**: Must support both MCP stdio and SSE entrypoints
- **Embedding model**: `qwen/qwen3-embedding-8b` via CherryIn API — not swappable without explicit config change in v1
- **Document formats**: txt, markdown, text-layer PDF only in v1
- **Security**: API keys in `.env` only; optional backend API key gate via env flag
- **Deployment**: Local-first scaffold; no cloud infra assumptions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MCP retrieval-only; ingestion via backend | Keeps MCP tools simple and fast; upload is admin workflow | — Pending |
| Chroma local vector store | Lightweight, persistent, good fit for single-machine scaffold | — Pending |
| Single collection v1, multi-collection-ready APIs | Ship fast without painting into a corner | — Pending |
| TypeScript/Node over Python | User preference (8-TS); MCP SDK parity | — Pending |
| Text-layer PDF only (no OCR) | Reduces v1 complexity and dependency surface | — Pending |
| Optional API key auth via env | Safe local dev default; easy hardening when needed | — Pending |
| Backend: REST + Web admin + CLI | User wants all three admin surfaces | — Pending |

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
*Last updated: 2026-06-29 after initialization*
